"""Generate stable VAPID settings into a NEW private file. Never overwrite keys."""
import base64
import os
from pathlib import Path
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

if len(sys.argv) != 3 or not sys.argv[2].startswith(('mailto:', 'https://')):
    raise SystemExit('Usage: python generate-push-keys.py /private/path/push.env mailto:admin@example.com')
if any(char in sys.argv[2] for char in '\r\n'):
    raise SystemExit('Contact must be a single line')

key = ec.generate_private_key(ec.SECP256R1())
encode = lambda data: base64.urlsafe_b64encode(data).decode().rstrip('=')
private = encode(key.private_numbers().private_value.to_bytes(32, 'big'))
public = encode(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
path = Path(sys.argv[1]).expanduser()
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(f'PUSH_ENABLED=true\nPUSH_VAPID_PRIVATE_KEY={private}\nPUSH_VAPID_PUBLIC_KEY={public}\nPUSH_VAPID_SUBJECT={sys.argv[2]}\n')
print('Created private push settings. Copy the settings directly into the API environment; keep the private key out of Git and chat.')
