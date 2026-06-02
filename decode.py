import urllib.request

url = "https://socialx-beta.vercel.app/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print("STATUS:", response.status)
        for k, v in response.headers.items():
            print(f"{k}: {v}")
except Exception as e:
    print("ERROR:", e)
