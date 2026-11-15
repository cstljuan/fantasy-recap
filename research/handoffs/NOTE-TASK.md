Repo /home/user/fantasy-recap, branch cstljuan/research. You write exactly one file: research/notes/<KEY>.json (KEY given in your prompt). Do not edit anything else, do not commit or push. Never read or print .env or keys.

Read research/README.md (rules) and research/notes/GOB-QB.json (the pattern: same fields and structure, including "scouts_read": one paragraph of 3 to 5 plain sentences, your scouting read on the next game based only on the facts in the note).

Find who the player is without reading the whole data file (150 KB). Use a snippet like:
python3 -c "import json;d=json.load(open('research/data/<KEY>.json'));print(list(d.keys()))"
then print only the small parts you need (bio, next games, injury reports, recent headlines, Wikipedia sections, 2026 summary).

Research with at most 5 web searches. Many sites refuse page fetches here (si.com, wikipedia); rely on search results and the Wikipedia sections stored in the data file (cite the Wikipedia URL). About 20 facts. Every fact has its source address (URL) and date (if no date is shown, write "date not shown"). Public reporting only from reputable outlets; nothing invented; nothing from memory about the 2026 season; if something is not found say "not found". Family: only what the person or reputable outlets made public, nothing about children beyond that. No em dashes anywhere. Never name an AI tool or model in the file. Today is 2026-11-15, NFL week 10 (Sunday games today, LAC at BAL Monday; WAS and NYG played Thursday).

Validate with python3 -m json.tool. Reply in under 100 words: the player, the key availability fact, and anything not found.
