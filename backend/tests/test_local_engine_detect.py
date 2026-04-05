"""Tests for LocalLLAMAEngine._detect_format — auto-detect chat format from model filename."""

from backend.ai_engine import LocalLLAMAEngine


class TestDetectFormat:
    def test_detect_gemma(self):
        fmt, stops = LocalLLAMAEngine._detect_format("gemma-2-9b-Q4.gguf")
        assert fmt == "gemma"
        assert "<end_of_turn>" in stops

    def test_detect_gemma4(self):
        fmt, stops = LocalLLAMAEngine._detect_format("gemma-4-12b-Q5_K_M.gguf")
        assert fmt == "gemma"
        assert "<end_of_turn>" in stops
        assert "<eos>" in stops

    def test_detect_llama3(self):
        fmt, stops = LocalLLAMAEngine._detect_format("Meta-Llama-3.1-8B-Instruct.gguf")
        assert fmt == "llama-3"
        assert "<|eot_id|>" in stops

    def test_detect_llama3_alt_naming(self):
        fmt, stops = LocalLLAMAEngine._detect_format("llama3-8b-q4.gguf")
        assert fmt == "llama-3"

    def test_detect_mistral(self):
        fmt, stops = LocalLLAMAEngine._detect_format("mistral-7b-instruct-v0.3.gguf")
        assert fmt == "chatml"
        assert "</s>" in stops

    def test_detect_mixtral(self):
        fmt, stops = LocalLLAMAEngine._detect_format("mixtral-8x7b-v0.1.gguf")
        assert fmt == "chatml"

    def test_detect_qwen(self):
        fmt, stops = LocalLLAMAEngine._detect_format("qwen2.5-7b-instruct.gguf")
        assert fmt == "chatml"
        assert "<|endoftext|>" in stops

    def test_detect_phi3(self):
        fmt, stops = LocalLLAMAEngine._detect_format("phi-3-mini-4k.gguf")
        assert fmt == "chatml"
        assert "<|end|>" in stops

    def test_detect_unknown_defaults_to_chatml(self):
        fmt, stops = LocalLLAMAEngine._detect_format("random-model-v1.gguf")
        assert fmt == "chatml"

    def test_detect_is_case_insensitive(self):
        fmt, _ = LocalLLAMAEngine._detect_format("GEMMA-2-27B.gguf")
        assert fmt == "gemma"

    def test_detect_full_path(self):
        fmt, _ = LocalLLAMAEngine._detect_format("/models/gguf/gemma-4-12b-Q5.gguf")
        assert fmt == "gemma"
