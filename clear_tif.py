#!/usr/bin/python
import os
import time

DIR = "."  # Current directory where script is located

now = time.time()
threshold = now - 24 * 3600  # 24 hours in seconds

deleted = []
for fname in os.listdir(DIR):
    if fname.lower().endswith('.tif'):
        fpath = os.path.join(DIR, fname)
        if os.path.isfile(fpath):
            mtime = os.path.getmtime(fpath)
            if mtime < threshold:
                try:
                    os.remove(fpath)
                    deleted.append(fname)
                except Exception as e:
                    print(f"Failed to delete {fname}: {e}")

print(f"Deleted {len(deleted)} .tif files older than 24 hours.")
if deleted:
    print("Deleted files:")
    for f in deleted:
        print(f"  - {f}")
