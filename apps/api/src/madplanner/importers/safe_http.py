import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import httpx


class UnsafeUrlError(ValueError):
    pass


class RecipeFetchError(RuntimeError):
    pass


class SafeHttpClient:
    def __init__(self, max_bytes: int = 5_000_000, max_redirects: int = 5) -> None:
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects

    def validate_url(self, url: str) -> str:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise UnsafeUrlError("Only HTTP and HTTPS recipe URLs are allowed")
        if not parsed.hostname or parsed.username or parsed.password:
            raise UnsafeUrlError("The recipe URL is not valid")
        if parsed.port and parsed.port not in {80, 443}:
            raise UnsafeUrlError("Only standard web ports are allowed")

        try:
            addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise UnsafeUrlError("The recipe hostname could not be resolved") from error

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if not ip.is_global:
                raise UnsafeUrlError("Private and local network addresses are not allowed")
        return url

    def fetch(self, url: str) -> str:
        current_url = self.validate_url(url)
        try:
            with httpx.Client(timeout=10, follow_redirects=False) as client:
                for _ in range(self.max_redirects + 1):
                    response = client.get(current_url, headers={"User-Agent": "MadPlanner/0.1 recipe importer"})
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise RecipeFetchError("The recipe site returned an invalid redirect")
                        current_url = self.validate_url(urljoin(current_url, location))
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "")
                    if "text/html" not in content_type:
                        raise RecipeFetchError("The URL did not return an HTML page")
                    if len(response.content) > self.max_bytes:
                        raise RecipeFetchError("The recipe page is too large")
                    return response.text
        except httpx.HTTPError as error:
            raise RecipeFetchError("The recipe page could not be downloaded") from error
        raise RecipeFetchError("The recipe site redirected too many times")
