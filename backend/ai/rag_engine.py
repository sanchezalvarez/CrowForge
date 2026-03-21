import os
import logging
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import pypdf
import docx
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class RAGEngine:
    _instance = None
    _model = None
    _index = None
    _chunks = [] # Stores (text, source_path) tuples

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RAGEngine, cls).__new__(cls)
        return cls._instance

    @property
    def model(self):
        if self._model is None:
            logger.info("Loading embedding model: all-MiniLM-L6-v2")
            # This is a small, fast model (80MB) that runs well on CPU
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
        return self._model

    def _extract_text(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        text = ""
        try:
            if ext == ".txt" or ext == ".md":
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            elif ext == ".pdf":
                with open(file_path, 'rb') as f:
                    reader = pypdf.PdfReader(f)
                    text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
            elif ext == ".docx":
                doc = docx.Document(file_path)
                text = "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
        return text

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        if not text: return []
        chunks = []
        for i in range(0, len(text), chunk_size - overlap):
            chunks.append(text[i:i + chunk_size])
        return chunks

    def index_directory(self, dir_path: str):
        """Index all supported files in a directory."""
        if not os.path.exists(dir_path):
            return {"error": f"Directory not found: {dir_path}"}

        logger.info(f"Indexing directory: {dir_path}")
        all_chunks = []
        all_metadata = []

        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.lower().endswith(('.txt', '.md', '.pdf', '.docx')):
                    path = os.path.join(root, file)
                    text = self._extract_text(path)
                    chunks = self._chunk_text(text)
                    for chunk in chunks:
                        all_chunks.append(chunk)
                        all_metadata.append({"path": path, "text": chunk})

        if not all_chunks:
            return {"status": "No valid documents found."}

        # Generate embeddings
        embeddings = self.model.encode(all_chunks)
        embeddings = np.array(embeddings).astype('float32')

        # Create FAISS index (Inner Product / Cosine Similarity after normalization)
        faiss.normalize_L2(embeddings)
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)

        self._index = index
        self._chunks = all_metadata
        
        return {"status": "success", "indexed_chunks": len(all_chunks)}

    def query(self, text: str, top_k: int = 5) -> List[Dict]:
        """Search the index for the most relevant chunks."""
        if self._index is None or not self._chunks:
            return []

        # Embed query
        query_embedding = self.model.encode([text])
        query_embedding = np.array(query_embedding).astype('float32')
        faiss.normalize_L2(query_embedding)

        # Search index
        distances, indices = self._index.search(query_embedding, top_k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self._chunks):
                results.append({
                    "text": self._chunks[idx]["text"],
                    "source": self._chunks[idx]["path"],
                    "score": float(distances[0][i])
                })
        
        return results
