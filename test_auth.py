import sys
import os
import hashlib
import sqlite3

# Mocking the functions from storage.py to test them in isolation
def hash_password(password: str, salt: str = None) -> str:
    salt_bytes = salt.encode("utf-8") if salt else os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 120000)
    return "pbkdf2$120000$" + salt_bytes.hex() + "$" + dk.hex()

def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$", 3)
        if algo != "pbkdf2":
            return False
        salt_bytes = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, int(iterations))
        return hashlib.compare_digest(dk, expected)
    except Exception as e:
        print(f"Verification error: {e}")
        return False

print("Testing password hashing...")
pwd = "admin123"
hashed = hash_password(pwd)
print(f"Password: {pwd}")
print(f"Hashed: {hashed}")

print("Testing verification...")
is_valid = verify_password(pwd, hashed)
print(f"Is valid: {is_valid}")

if not is_valid:
    print("CRITICAL: Password verification failed!")
    sys.exit(1)

print("Testing database user...")
try:
    conn = sqlite3.connect("/opt/email-validator/data/validations.db")
    cursor = conn.execute("SELECT username, password_hash FROM users")
    users = cursor.fetchall()
    print(f"Found {len(users)} users in DB:")
    for user in users:
        username, stored_hash = user
        print(f"User: {username}")
        print(f"Stored Hash: {stored_hash}")
        if username == "admin":
            print(f"Testing admin password 'admin123' against DB hash...")
            db_valid = verify_password("admin123", stored_hash)
            print(f"Admin DB valid: {db_valid}")
except Exception as e:
    print(f"Database error: {e}")
