"""Thin async wrapper around the PocketBase REST API."""

from typing import Any, Optional

import httpx


class PocketBaseClient:
    """Async client for PocketBase REST API using httpx."""

    def __init__(self, base_url: str = "http://127.0.0.1:8090", admin_token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.admin_token = admin_token

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.admin_token:
            headers["Authorization"] = f"Bearer {self.admin_token}"
        return headers

    async def authenticate_admin(self, email: str, password: str) -> dict[str, Any]:
        """Authenticate as an admin and store the auth token.

        Returns the full auth response including the token and admin record.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/admins/auth-with-password",
                json={"identity": email, "password": password},
            )
            response.raise_for_status()
            data = response.json()
            self.admin_token = data["token"]
            return data

    async def get_list(
        self,
        collection: str,
        page: int = 1,
        per_page: int = 30,
        filter: Optional[str] = None,
        sort: Optional[str] = None,
    ) -> dict[str, Any]:
        """List records from a collection with optional filtering and sorting."""
        params: dict[str, Any] = {"page": page, "perPage": per_page}
        if filter:
            params["filter"] = filter
        if sort:
            params["sort"] = sort

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/collections/{collection}/records",
                headers=self._headers(),
                params=params,
            )
            response.raise_for_status()
            return response.json()

    async def get_one(self, collection: str, record_id: str) -> dict[str, Any]:
        """Get a single record by ID."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/collections/{collection}/records/{record_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def create(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new record in a collection."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/collections/{collection}/records",
                headers=self._headers(),
                json=data,
            )
            response.raise_for_status()
            return response.json()

    async def update(self, collection: str, record_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update an existing record."""
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/api/collections/{collection}/records/{record_id}",
                headers=self._headers(),
                json=data,
            )
            response.raise_for_status()
            return response.json()

    async def delete(self, collection: str, record_id: str) -> None:
        """Delete a record by ID."""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/api/collections/{collection}/records/{record_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
