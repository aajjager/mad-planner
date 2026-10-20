"""CONNECT-only proxy: agent inference can reach OpenAI, never the LAN."""
import ipaddress
import select
import socket
import socketserver
import os

ALLOWED = {'chatgpt.com', 'api.openai.com', 'auth.openai.com', 'ab.chatgpt.com'}


def permitted(host, port, public_https=False):
    return (host.lower() in ALLOWED or public_https) and port == '443'


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(20)
        line = self.rfile.readline(4096).decode('ascii', errors='replace').strip().split()
        if len(line) != 3 or line[0] != 'CONNECT':
            self.wfile.write(b'HTTP/1.1 403 Forbidden\r\n\r\n'); return
        host, separator, port = line[1].rpartition(':')
        if not separator or not permitted(host, port, os.getenv('PROXY_PUBLIC_HTTPS') == '1'):
            self.wfile.write(b'HTTP/1.1 403 Forbidden\r\n\r\n'); return
        for _ in range(50):
            header = self.rfile.readline(8192)
            if header in (b'\r\n', b'\n', b''):
                break
        else:
            return
        # Pin the resolved public IP, avoiding private-address DNS answers.
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        upstream = None
        for family, kind, proto, _, address in addresses:
            if not ipaddress.ip_address(address[0]).is_global:
                continue
            candidate = socket.socket(family, kind, proto)
            try:
                candidate.settimeout(15); candidate.connect(address); upstream = candidate; break
            except OSError:
                candidate.close()
        if upstream is None:
            self.wfile.write(b'HTTP/1.1 502 Bad Gateway\r\n\r\n'); return
        with upstream:
            self.wfile.write(b'HTTP/1.1 200 Connection Established\r\n\r\n'); self.wfile.flush()
            while True:
                readable, _, _ = select.select([self.connection, upstream], [], [], 180)
                if not readable:
                    return
                for source in readable:
                    data = source.recv(65536)
                    if not data:
                        return
                    (upstream if source is self.connection else self.connection).sendall(data)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Server(('0.0.0.0', 3128), Handler) as server:
        server.serve_forever()
