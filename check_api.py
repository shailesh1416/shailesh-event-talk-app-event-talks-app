import requests

try:
    response = requests.get("http://127.0.0.1:5000/api/updates", timeout=5)
    response.raise_for_status()
    data = response.json()
    updates = data.get("updates", [])
    print("Total updates parsed:", len(updates))
    if updates:
        print("First update detail:")
        print("  ID:", updates[0].get("id"))
        print("  Date:", updates[0].get("date"))
        print("  Category:", updates[0].get("category"))
        print("  Content HTML Length:", len(updates[0].get("content_html", "")))
        print("  Content Text Length:", len(updates[0].get("content_text", "")))
        print("  Content HTML Snippet:", updates[0].get("content_html")[:200])
        print("  Content Text Snippet:", updates[0].get("content_text")[:200])
    else:
        print("No updates found in API response!")
except Exception as e:
    print("Error fetching local API:", e)
