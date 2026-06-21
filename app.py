from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
import re
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_fetched": None
}
CACHE_EXPIRY_SECONDS = 300  # 5 minutes cache

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = "{http://www.w3.org/2005/Atom}"

def clean_text_for_tweet(html_content):
    """
    Strips HTML tags and formatting to create a clean, readable text representation
    suitable for a tweet preview.
    """
    if not html_content:
        return ""
    # Replace line-breaking HTML tags with newlines
    text = re.sub(r'</?(?:p|br|div|li|ol|ul|h3|h4)>', '\n', html_content)
    # Strip any other XML/HTML tags
    text = re.sub(r'<[^<]+?>', '', text)
    # Decode common HTML entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")
    # Clean up excess whitespace and consecutive empty lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)

def parse_xml_feed(xml_bytes):
    """
    Parses the BigQuery Release Notes Atom XML feed.
    Splits each entry's HTML content by <h3> headers into individual updates.
    """
    root = ET.fromstring(xml_bytes)
    all_updates = []
    
    # Atom feed elements: <entry>
    entries = root.findall(f"{ATOM_NS}entry")
    
    for entry in entries:
        # Date of the update is stored in the <title> or <updated> field
        # E.g. <title>June 17, 2026</title>
        title_el = entry.find(f"{ATOM_NS}title")
        date_str = title_el.text.strip() if title_el is not None and title_el.text else "Unknown Date"
        
        # ID of the entry
        id_el = entry.find(f"{ATOM_NS}id")
        entry_id = id_el.text.strip() if id_el is not None and id_el.text else str(hash(date_str))
        # Keep only the anchor/id part for reference links (e.g. tag:google...#June_17_2026 -> June_17_2026)
        id_anchor = entry_id.split("#")[-1] if "#" in entry_id else date_str.replace(" ", "_").replace(",", "")
        
        # HTML content
        content_el = entry.find(f"{ATOM_NS}content")
        content_html = content_el.text if content_el is not None and content_el.text else ""
        
        if not content_html:
            continue
            
        # Google release notes content is structured using <h3> headings (e.g. <h3>Feature</h3>, <h3>Fix</h3>)
        # Find all <h3> segments
        matches = list(re.finditer(r'<h3>(.*?)</h3>', content_html))
        
        if not matches:
            # If no <h3> header found, parse as a single update
            plain_text = clean_text_for_tweet(content_html)
            all_updates.append({
                "id": f"{id_anchor}_0",
                "date": date_str,
                "category": "Update",
                "content_html": content_html,
                "content_text": plain_text,
                "anchor": id_anchor,
                "ref_link": f"https://cloud.google.com/bigquery/docs/release-notes#{id_anchor}"
            })
            continue
            
        for i, match in enumerate(matches):
            category = match.group(1).strip()
            start_pos = match.end()
            end_pos = matches[i+1].start() if i + 1 < len(matches) else len(content_html)
            
            sub_html = content_html[start_pos:end_pos].strip()
            plain_text = clean_text_for_tweet(sub_html)
            
            # Construct a clean individual HTML payload including the header
            full_sub_html = f"<h3>{category}</h3>\n{sub_html}"
            
            all_updates.append({
                "id": f"{id_anchor}_{i}",
                "date": date_str,
                "category": category,
                "content_html": full_sub_html,
                "content_text": plain_text,
                "anchor": id_anchor,
                "ref_link": f"https://cloud.google.com/bigquery/docs/release-notes#{id_anchor}"
            })
            
    return all_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/updates')
def get_updates():
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    now = datetime.now()
    
    # Check cache validity
    if not force_refresh and cache["data"] is not None and cache["last_fetched"] is not None:
        elapsed = (now - cache["last_fetched"]).total_seconds()
        if elapsed < CACHE_EXPIRY_SECONDS:
            logger.info("Serving BigQuery Release Notes from memory cache")
            return jsonify({
                "source": "cache",
                "last_fetched": cache["last_fetched"].isoformat(),
                "updates": cache["data"]
            })
            
    try:
        logger.info(f"Fetching fresh feed from: {FEED_URL}")
        response = requests.get(FEED_URL, timeout=12)
        response.raise_for_status()
        
        updates = parse_xml_feed(response.content)
        
        # Save to cache
        cache["data"] = updates
        cache["last_fetched"] = now
        
        return jsonify({
            "source": "network",
            "last_fetched": now.isoformat(),
            "updates": updates
        })
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error fetching release notes: {e}")
        # If network fail but cache exists, fall back to cache
        if cache["data"] is not None:
            logger.warning("Network request failed, falling back to expired cache")
            return jsonify({
                "source": "cache_fallback",
                "last_fetched": cache["last_fetched"].isoformat(),
                "updates": cache["data"],
                "error": "Failed to fetch fresh data. Showing cached release notes."
            }), 200
        return jsonify({"error": f"Failed to connect to feed service: {str(e)}"}), 502
    except Exception as e:
        logger.error(f"Unexpected error processing feed: {e}")
        return jsonify({"error": f"Internal processing error: {str(e)}"}), 500

if __name__ == '__main__':
    # Running Flask app on port 5000 in debug mode
    app.run(host='127.0.0.1', port=5000, debug=True)
