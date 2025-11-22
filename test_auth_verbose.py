import sys
import os
import hashlib
import sqlite3
import binascii

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

print("--- DIAGNOSTIC START ---")

def hash_password(password: str, salt: str = None) -> str:
    try:
        print(f"Hashing password: '{password}'")
        if salt:
            print(f"Using provided salt: '{salt}'")
            salt_bytes = salt.encode("utf-8")
        else:
            print("Generating random salt")
            salt_bytes = os.urandom(16)
        
        print(f"Salt bytes (hex): {salt_bytes.hex()}")
        
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 120000)
        print(f"Derived key (hex): {dk.hex()}")
        
        result = "pbkdf2$120000$" + salt_bytes.hex() + "$" + dk.hex()
        print(f"Full hash string: {result}")
        return result
    except Exception as e:
        print(f"ERROR in hash_password: {e}")
        raise

def verify_password(password: str, stored: str) -> bool:
    try:
        print(f"Verifying password: '{password}' against stored: '{stored}'")
        parts = stored.split("$", 3)
        if len(parts) != 4:
            print(f"ERROR: Invalid hash format. Parts: {len(parts)}")
            return False
            
        algo, iterations, salt_hex, hash_hex = parts
        print(f"Parsed: algo={algo}, iter={iterations}, salt={salt_hex}, hash={hash_hex}")
        
        if algo != "pbkdf2":
            print(f"ERROR: Unsupported algo {algo}")
            return False
            
        salt_bytes = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, int(iterations))
        print(f"Computed key (hex): {dk.hex()}")
        
        match = hashlib.compare_digest(dk, expected)
        print(f"Match result: {match}")
        return match
    except Exception as e:
        print(f"ERROR in verify_password: {e}")
        import traceback
        traceback.print_exc()
        return False

print("\n1. Testing local hash/verify cycle...")
pwd = "admin123"
hashed = hash_password(pwd)
is_valid = verify_password(pwd, hashed)

if not is_valid:
    print("CRITICAL: Local verification failed!")
else:
    print("SUCCESS: Local verification passed.")

print("\n2. Inspecting Database...")
db_path = "/opt/email-validator/data/validations.db"
if not os.path.exists(db_path):
    print(f"ERROR: Database not found at {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT username, password_hash, role FROM users")
        users = cursor.fetchall()
        print(f"Found {len(users)} users.")
        
        for user in users:
            username, stored_hash, role = user
            print(f"\nUser: {username} ({role})")
            print(f"Stored Hash: {stored_hash}")
            
            if username == "admin":
                print("Testing 'admin123'...")
                valid = verify_password("admin123", stored_hash)
                print(f"Result: {'VALID' if valid else 'INVALID'}")
            else:
                print("Skipping password test for non-admin user")
                
    except Exception as e:
        print(f"Database error: {e}")

print("--- DIAGNOSTIC END ---")
