"""
Semantic Training Data Generator
=================================
Generates (natural-language prompt → structured JSON) pairs for fine-tuning
T5-small as a real semantic parser for volunteer constraint extraction.

The output schema is richer than the old slot-filler:
{
  "groups": [
    {"count": 2, "college": "CCE", "gender": "F", "new_old": "new"}
  ],
  "global": {
    "conflict_ok": false,
    "priority_rules": ["attendance_first"]
  },
  "is_confirming": false
}

Run: python generate_semantic_data.py
Output: semantic_training_data.jsonl  (~2400 examples)
"""

import json
import random
import itertools
from pathlib import Path

random.seed(42)

# ─────────────────────────────────────────────────────────────────────────────
# Domain vocabulary
# ─────────────────────────────────────────────────────────────────────────────

COLLEGES = {
    "CCE":  ["CCE", "computing", "computer science", "IT", "BSCS", "BSIT", "tech", "computer students"],
    "CTE":  ["CTE", "education", "teacher ed", "BSED", "teachers", "teacher education"],
    "CEE":  ["CEE", "engineering", "BSEE", "engineers", "civil engineering", "mechanical engineering"],
    "CAE":  ["CAE", "accounting", "BSBA accounting", "accountancy", "BSA", "accountants"],
    "CCJE": ["CCJE", "criminology", "criminal justice", "crimson", "crim", "BSCrim"],
    "CBAE": ["CBAE", "business", "BSBA", "business administration", "management"],
    "CHE":  ["CHE", "hospitality", "HRM", "hotel management", "tourism", "hotel and restaurant"],
    "CHSE": ["CHSE", "health sciences", "BSPH", "public health", "health"],
    "CASE": ["CASE", "arts and sciences", "liberal arts", "BSPS", "science"],
    "CAFE": ["CAFE", "architecture", "fine arts", "design", "architect", "BSARCH"],
}

GENDER_TERMS = {
    "M": ["male", "lalaki", "guys", "men", "boys", "male members", "kuya"],
    "F": ["female", "babae", "girls", "women", "ladies", "female members", "ate"],
}

NEW_TERMS = {
    "new":  ["freshie", "freshman", "new member", "baguhan", "bago", "newly joined", "first year", "freshy", "newbie"],
    "old":  ["veteran", "experienced", "old member", "luma", "senior member", "returning", "tenured"],
}

CONFLICT_FALSE = [
    "no class conflicts", "only those who are free", "skip members with class",
    "walang klase", "wala pang klase", "available lang", "not busy with class",
    "exclude members with class", "those with free schedule only",
]

CONFLICT_TRUE = [
    "even with class conflicts", "regardless of schedule", "kahit may klase",
    "include those with class", "class conflict is fine", "ignore class schedule",
    "even if they have class", "walang pakialam sa klase",
]

PRIORITY_MAP = {
    "male_first":       ["prioritize males", "guys first", "lalaki muna", "males go first", "rank males higher"],
    "female_first":     ["prioritize females", "girls first", "babae muna", "ladies go first", "rank females higher"],
    "new_first":        ["freshies first", "new members first", "bago muna", "prioritize freshmen", "rookies first"],
    "old_first":        ["veterans first", "experienced first", "luma muna", "senior members first", "returning members first"],
    "attendance_first": ["highest attendance first", "most reliable first", "rank by attendance", "best attendance priority"],
}

CONFIRM_PHRASES = [
    "yes", "yeah", "yep", "yup", "sure", "okay", "ok", "go ahead",
    "proceed", "assign them", "confirm", "push through", "do it",
    "sige", "oo", "opo", "tuloy na", "go na", "let's do it",
    "that's fine", "sounds good", "perfect", "assign now",
    "yes please", "yes go ahead", "yes assign them", "yes that's correct",
    "correct go ahead", "looks good assign", "assign the selected ones",
]

COUNTS = list(range(1, 8))

SLOT_VERBS = [
    "I need", "I want", "Give me", "Please get", "Assign", "Get me",
    "I'd like", "Provide", "Send me", "Kumuha ng", "Kailangan ko ng",
    "Gusto ko ng", "I require",
]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def empty_group():
    return {"count": None, "college": None, "gender": None, "new_old": None,
            "height_min": None, "height_max": None}

def empty_global():
    return {"conflict_ok": None, "priority_rules": [], "height_rule": None}

def clean_group(g: dict) -> dict:
    """Remove null fields for compactness."""
    return {k: v for k, v in g.items() if v is not None}

def clean_global(g: dict) -> dict:
    out = {}
    if g["conflict_ok"] is not None:
        out["conflict_ok"] = g["conflict_ok"]
    if g["priority_rules"]:
        out["priority_rules"] = g["priority_rules"]
    if g.get("height_rule") is not None:
        out["height_rule"] = g["height_rule"]
    return out

def schema(groups, glob=None, confirming=False):
    glob = glob or empty_global()
    result = {}
    clean_groups = [clean_group(g) for g in groups if clean_group(g)]
    if clean_groups:
        result["groups"] = clean_groups
    cg = clean_global(glob)
    if cg:
        result["global"] = cg
    if confirming:
        result["is_confirming"] = True
    return json.dumps(result, ensure_ascii=False)

def rand_college_term(abbrev):
    return random.choice(COLLEGES[abbrev])

def rand_gender_term(code):
    return random.choice(GENDER_TERMS[code])

def rand_new_term(code):
    return random.choice(NEW_TERMS[code])

def rand_verb():
    return random.choice(SLOT_VERBS)

def rand_count():
    return random.choice(COUNTS)

# ─────────────────────────────────────────────────────────────────────────────
# Generator functions — each returns list of (text, json_str) tuples
# ─────────────────────────────────────────────────────────────────────────────

def gen_single_college(n=60):
    """I need 2 from CCE"""
    examples = []
    for abbrev in COLLEGES:
        for _ in range(n // len(COLLEGES)):
            count = rand_count()
            term = rand_college_term(abbrev)
            group = {**empty_group(), "count": count, "college": abbrev}
            templates = [
                f"{rand_verb()} {count} from {term}",
                f"{rand_verb()} {count} {term} members",
                f"{count} from {term} please",
                f"{count} {term} lang",
                f"Get {count} volunteers from {term}",
                f"{count} members from {term} only",
                f"Kumuha ng {count} from {term}",
            ]
            for t in templates:
                examples.append((t, schema([group])))
    return examples


def gen_multi_college(n=80):
    """I want 2 from CCE and 1 from CASE"""
    examples = []
    college_pairs = list(itertools.permutations(list(COLLEGES.keys()), 2))
    random.shuffle(college_pairs)
    for c1, c2 in college_pairs[:n]:
        count1, count2 = rand_count(), rand_count()
        t1, t2 = rand_college_term(c1), rand_college_term(c2)
        group1 = {**empty_group(), "count": count1, "college": c1}
        group2 = {**empty_group(), "count": count2, "college": c2}
        templates = [
            f"{rand_verb()} {count1} from {t1} and {count2} from {t2}",
            f"{count1} {t1} and {count2} {t2}",
            f"Get {count1} from {t1} then {count2} from {t2}",
            f"{rand_verb()} {count1} {t1} members and {count2} {t2} members",
            f"{count1} from {t1}, {count2} from {t2}",
        ]
        for t in random.sample(templates, min(3, len(templates))):
            examples.append((t, schema([group1, group2])))
    return examples


def gen_three_colleges(n=30):
    """2 from CCE, 1 from CASE, and 1 from CAE"""
    examples = []
    colleges = list(COLLEGES.keys())
    for _ in range(n):
        sample = random.sample(colleges, 3)
        counts = [rand_count() for _ in range(3)]
        terms = [rand_college_term(c) for c in sample]
        groups = [{**empty_group(), "count": counts[i], "college": sample[i]} for i in range(3)]
        t = (f"{rand_verb()} {counts[0]} from {terms[0]}, "
             f"{counts[1]} from {terms[1]}, and {counts[2]} from {terms[2]}")
        examples.append((t, schema(groups)))
        t2 = (f"{counts[0]} {terms[0]}, {counts[1]} {terms[1]}, {counts[2]} {terms[2]}")
        examples.append((t2, schema(groups)))
    return examples


def gen_gender_count(n=60):
    """3 males, 2 females"""
    examples = []
    for gender_code in ["M", "F"]:
        for _ in range(n // 2):
            count = rand_count()
            term = rand_gender_term(gender_code)
            group = {**empty_group(), "count": count, "gender": gender_code}
            templates = [
                f"{rand_verb()} {count} {term}",
                f"{count} {term} only",
                f"{term} lang, {count} of them",
                f"Get {count} {term}",
                f"{count} {term} members please",
                f"Gusto ko ng {count} {term}",
            ]
            for t in templates:
                examples.append((t, schema([group])))
    return examples


def gen_gender_split(n=40):
    """2 males and 1 female"""
    examples = []
    for _ in range(n):
        male_count = rand_count()
        female_count = rand_count()
        mt = rand_gender_term("M")
        ft = rand_gender_term("F")
        g1 = {**empty_group(), "count": male_count, "gender": "M"}
        g2 = {**empty_group(), "count": female_count, "gender": "F"}
        templates = [
            f"{rand_verb()} {male_count} {mt} and {female_count} {ft}",
            f"{male_count} {mt}, {female_count} {ft}",
            f"Mix of {male_count} {mt} and {female_count} {ft}",
            f"{male_count} {mt} tapos {female_count} {ft}",
            f"Get {male_count} {mt} and {female_count} {ft}",
        ]
        for t in templates:
            examples.append((t, schema([g1, g2])))
    return examples


def gen_new_old(n=60):
    """freshies only, veterans only"""
    examples = []
    for code in ["new", "old"]:
        for _ in range(n // 2):
            count = rand_count()
            term = rand_new_term(code)
            group = {**empty_group(), "count": count, "new_old": code}
            templates = [
                f"{rand_verb()} {count} {term}",
                f"{count} {term} lang",
                f"{term} members, {count} of them",
                f"Get {count} {term} members",
                f"{count} {term} please",
                f"Gusto ko ng {count} {term}",
                f"{term} lang, {count}",
            ]
            for t in templates:
                examples.append((t, schema([group])))
    return examples


def gen_college_gender(n=80):
    """2 female from CCE"""
    examples = []
    for abbrev in COLLEGES:
        for gender_code in ["M", "F"]:
            for _ in range(n // (len(COLLEGES) * 2)):
                count = rand_count()
                ct = rand_college_term(abbrev)
                gt = rand_gender_term(gender_code)
                group = {**empty_group(), "count": count, "college": abbrev, "gender": gender_code}
                templates = [
                    f"{rand_verb()} {count} {gt} from {ct}",
                    f"{count} {gt} {ct} members",
                    f"{ct} {gt} lang, {count}",
                    f"Get {count} {gt} volunteers from {ct}",
                    f"{count} {ct} {gt}",
                    f"{rand_verb()} {count} {gt} na taga-{ct}",
                ]
                for t in templates:
                    examples.append((t, schema([group])))
    return examples


def gen_college_new_old(n=80):
    """freshies from CCE"""
    examples = []
    for abbrev in COLLEGES:
        for no_code in ["new", "old"]:
            for _ in range(n // (len(COLLEGES) * 2)):
                count = rand_count()
                ct = rand_college_term(abbrev)
                nt = rand_new_term(no_code)
                group = {**empty_group(), "count": count, "college": abbrev, "new_old": no_code}
                templates = [
                    f"{rand_verb()} {count} {nt} from {ct}",
                    f"{count} {nt} {ct} students",
                    f"{ct} {nt} lang, {count} of them",
                    f"Get {count} {nt} volunteers from {ct}",
                    f"{nt} galing {ct}, {count}",
                ]
                for t in templates:
                    examples.append((t, schema([group])))
    return examples


def gen_college_gender_new(n=60):
    """2 new female from CCE"""
    examples = []
    abbrevs = list(COLLEGES.keys())
    for _ in range(n):
        abbrev = random.choice(abbrevs)
        gender_code = random.choice(["M", "F"])
        no_code = random.choice(["new", "old"])
        count = rand_count()
        ct = rand_college_term(abbrev)
        gt = rand_gender_term(gender_code)
        nt = rand_new_term(no_code)
        group = {**empty_group(), "count": count, "college": abbrev, "gender": gender_code, "new_old": no_code}
        templates = [
            f"{rand_verb()} {count} {nt} {gt} from {ct}",
            f"{count} {gt} {nt} from {ct}",
            f"{nt} {gt} galing {ct}, {count}",
            f"Get {count} {gt} {nt} members from {ct}",
            f"{count} {ct} {gt} {nt}",
        ]
        for t in templates:
            examples.append((t, schema([group])))
    return examples


def gen_multi_group_mixed(n=60):
    """2 female from CCE and 1 new male from CEE"""
    examples = []
    colleges = list(COLLEGES.keys())
    for _ in range(n):
        c1, c2 = random.sample(colleges, 2)
        cnt1, cnt2 = rand_count(), rand_count()
        g1_gender = random.choice(["M", "F", None])
        g2_gender = random.choice(["M", "F", None])
        g1_no     = random.choice(["new", "old", None])
        g2_no     = random.choice(["new", "old", None])
        t1 = rand_college_term(c1)
        t2 = rand_college_term(c2)

        group1 = {**empty_group(), "count": cnt1, "college": c1}
        group2 = {**empty_group(), "count": cnt2, "college": c2}
        if g1_gender: group1["gender"] = g1_gender
        if g1_no:     group1["new_old"] = g1_no
        if g2_gender: group2["gender"] = g2_gender
        if g2_no:     group2["new_old"] = g2_no

        parts1 = []
        if g1_gender: parts1.append(rand_gender_term(g1_gender))
        if g1_no:     parts1.append(rand_new_term(g1_no))
        parts1.append(f"from {t1}")

        parts2 = []
        if g2_gender: parts2.append(rand_gender_term(g2_gender))
        if g2_no:     parts2.append(rand_new_term(g2_no))
        parts2.append(f"from {t2}")

        text = f"{rand_verb()} {cnt1} {' '.join(parts1)} and {cnt2} {' '.join(parts2)}"
        examples.append((text, schema([group1, group2])))

    return examples


def gen_conflict(n=60):
    examples = []
    for phrase in CONFLICT_FALSE:
        g = empty_global()
        g["conflict_ok"] = False
        examples.append((phrase, schema([], g)))
        # With count
        count = rand_count()
        examples.append((
            f"{rand_verb()} {count} volunteers, {phrase}",
            schema([{**empty_group(), "count": count}], g)
        ))
    for phrase in CONFLICT_TRUE:
        g = empty_global()
        g["conflict_ok"] = True
        examples.append((phrase, schema([], g)))
    return examples[:n]


def gen_priority(n=60):
    examples = []
    for rule, phrases in PRIORITY_MAP.items():
        for phrase in phrases:
            g = empty_global()
            g["priority_rules"] = [rule]
            examples.append((phrase, schema([], g)))
            # Combined with count
            count = rand_count()
            combined = f"{rand_verb()} {count} volunteers, {phrase}"
            examples.append((combined, schema([{**empty_group(), "count": count}], g)))
    return examples[:n]


def gen_combined_global(n=60):
    """No class conflicts, prioritize females"""
    examples = []
    for _ in range(n):
        rule = random.choice(list(PRIORITY_MAP.keys()))
        conflict = random.choice([True, False])
        priority_phrase = random.choice(PRIORITY_MAP[rule])
        conflict_phrase = random.choice(CONFLICT_FALSE if not conflict else CONFLICT_TRUE)
        g = empty_global()
        g["conflict_ok"] = conflict
        g["priority_rules"] = [rule]
        count = rand_count()
        texts = [
            f"{conflict_phrase}, {priority_phrase}",
            f"{priority_phrase}, {conflict_phrase}",
            f"{rand_verb()} {count} members — {conflict_phrase} and {priority_phrase}",
        ]
        for t in texts:
            examples.append((t, schema([], g)))
    return examples[:n]


def gen_college_with_global(n=60):
    """CCE members, no class conflicts"""
    examples = []
    abbrevs = list(COLLEGES.keys())
    for _ in range(n):
        abbrev = random.choice(abbrevs)
        ct = rand_college_term(abbrev)
        count = rand_count()
        conflict = random.choice([True, False])
        conflict_phrase = random.choice(CONFLICT_FALSE if not conflict else CONFLICT_TRUE)
        g = empty_global()
        g["conflict_ok"] = conflict
        group = {**empty_group(), "count": count, "college": abbrev}
        texts = [
            f"{rand_verb()} {count} from {ct}, {conflict_phrase}",
            f"{count} {ct} members — {conflict_phrase}",
            f"{conflict_phrase}, get {count} from {ct}",
        ]
        for t in texts:
            examples.append((t, schema([group], g)))
    return examples[:n]


def gen_confirm(n=80):
    examples = []
    for phrase in CONFIRM_PHRASES:
        examples.append((phrase, schema([], confirming=True)))
        # Natural language variants
        extras = [
            f"{phrase}, that looks good",
            f"yes, {phrase}",
            f"{phrase} na",
            f"okay {phrase}",
        ]
        for e in extras:
            examples.append((e, schema([], confirming=True)))
    random.shuffle(examples)
    return examples[:n]


def gen_free_form(n=40):
    """Unstructured real-world prompts"""
    examples = []
    raw = [
        ("Recommend volunteers for the event", schema([])),
        ("Who should I assign?", schema([])),
        ("Best available members please", schema([])),
        ("Give me your best picks", schema([])),
        ("Who are available today?", schema([])),
        ("Need volunteers ASAP", schema([{**empty_group(), "count": 1}])),
        ("Sino pwede mag-volunteer?", schema([])),
        ("Sino available?", schema([])),
        ("Suggest some volunteers", schema([])),
        ("I need help choosing volunteers", schema([])),
    ]
    for text, j in raw:
        examples.append((text, j))
    # Generate with counts
    for _ in range(n - len(raw)):
        count = rand_count()
        examples.append((
            f"{rand_verb()} {count} volunteers",
            schema([{**empty_group(), "count": count}])
        ))
    return examples


def gen_height(n=80):
    """Height constraints: per-group min/max and cross-group comparison rules."""
    examples = []

    # Cross-group comparative rules
    cross_templates = [
        ("Need 1 male and 1 female, male must be taller than the female",
         [{"count": 1, "gender": "M"}, {"count": 1, "gender": "F"}],
         {"height_rule": "male_taller_than_female"}),
        ("1 male and 1 female where the male is taller",
         [{"count": 1, "gender": "M"}, {"count": 1, "gender": "F"}],
         {"height_rule": "male_taller_than_female"}),
        ("male volunteer must be taller than the female volunteer",
         [{"count": 1, "gender": "M"}, {"count": 1, "gender": "F"}],
         {"height_rule": "male_taller_than_female"}),
        ("Need 1 female and 1 male, female must be taller than the male",
         [{"count": 1, "gender": "F"}, {"count": 1, "gender": "M"}],
         {"height_rule": "female_taller_than_male"}),
        ("female must be taller than male",
         [{"count": 1, "gender": "F"}, {"count": 1, "gender": "M"}],
         {"height_rule": "female_taller_than_male"}),
        ("tallest volunteers first",
         [],
         {"height_rule": "tallest_first"}),
        ("prioritize the tallest members",
         [],
         {"height_rule": "tallest_first"}),
        ("get the tallest ones",
         [],
         {"height_rule": "tallest_first"}),
        ("shortest volunteers first",
         [],
         {"height_rule": "shortest_first"}),
        ("prefer shorter volunteers",
         [],
         {"height_rule": "shortest_first"}),
        ("Need the tallest available volunteer",
         [],
         {"height_rule": "tallest_first"}),
    ]
    for text, grps, glob_extra in cross_templates:
        g = {**empty_global(), **glob_extra}
        if grps:
            groups = [{**empty_group(), **grp} for grp in grps]
        else:
            groups = []
        examples.append((text, schema(groups, g)))

    # Per-group height min
    heights_min = [160, 165, 170, 175, 180]
    for h in heights_min:
        g_male   = {**empty_group(), "count": 1, "gender": "M", "height_min": h}
        g_female = {**empty_group(), "count": 1, "gender": "F", "height_min": h}
        examples += [
            (f"male must be at least {h}cm tall",
             schema([g_male])),
            (f"need a male volunteer at least {h} cm",
             schema([g_male])),
            (f"female at least {h}cm",
             schema([g_female])),
            (f"volunteer minimum height {h}cm",
             schema([{**empty_group(), "count": 1, "height_min": h}])),
        ]

    # Per-group height max
    heights_max = [155, 160, 165, 170]
    for h in heights_max:
        g_f = {**empty_group(), "count": 1, "gender": "F", "height_max": h}
        examples += [
            (f"female must be at most {h}cm",
             schema([g_f])),
            (f"female no taller than {h} cm",
             schema([g_f])),
            (f"volunteer maximum height {h}cm",
             schema([{**empty_group(), "count": 1, "height_max": h}])),
        ]

    # Combined cross-group + min height
    for h in [165, 170, 175]:
        grp_m = {**empty_group(), "count": 1, "gender": "M", "height_min": h}
        grp_f = {**empty_group(), "count": 1, "gender": "F"}
        g = {**empty_global(), "height_rule": "male_taller_than_female"}
        examples.append((
            f"1 male at least {h}cm and 1 female, male taller than female",
            schema([grp_m, grp_f], g)
        ))

    # Pad to n
    while len(examples) < n:
        h = random.choice([155, 160, 165, 170, 175, 180])
        rule = random.choice(["tallest_first", "shortest_first",
                               "male_taller_than_female", "female_taller_than_male"])
        grps: list = []
        if "taller_than" in rule:
            grps = [{**empty_group(), "count": 1, "gender": "M"},
                    {**empty_group(), "count": 1, "gender": "F"}]
        g = {**empty_global(), "height_rule": rule}
        verbs = {
            "tallest_first": "prioritize tallest members",
            "shortest_first": "prefer shortest members",
            "male_taller_than_female": "male must be taller than female",
            "female_taller_than_male": "female must be taller than male",
        }
        examples.append((verbs[rule], schema(grps, g)))

    return examples[:n]


def gen_tagalog_mixed(n=60):
    """Mix of Filipino and English constraints"""
    examples = []
    templates = [
        ("Gusto ko ng {count} {gt} from {ct}", lambda c, g, no, col: (
            {**empty_group(), "count": c, "gender": g, "college": col}
        )),
        ("{count} {nt} lang from {ct}", lambda c, g, no, col: (
            {**empty_group(), "count": c, "new_old": no, "college": col}
        )),
        ("Pakikuha ng {count} {gt} na {nt}", lambda c, g, no, col: (
            {**empty_group(), "count": c, "gender": g, "new_old": no}
        )),
        ("{count} {nt} {gt} from {ct} please", lambda c, g, no, col: (
            {**empty_group(), "count": c, "gender": g, "new_old": no, "college": col}
        )),
    ]
    abbrevs = list(COLLEGES.keys())
    for _ in range(n):
        c = rand_count()
        g = random.choice(["M", "F"])
        no = random.choice(["new", "old"])
        col = random.choice(abbrevs)
        gt = rand_gender_term(g)
        nt = rand_new_term(no)
        ct = rand_college_term(col)
        tmpl, builder = random.choice(templates)
        text = tmpl.format(count=c, gt=gt, nt=nt, ct=ct)
        group = builder(c, g, no, col)
        examples.append((text, schema([group])))
    return examples


# ─────────────────────────────────────────────────────────────────────────────
# Assemble and write
# ─────────────────────────────────────────────────────────────────────────────

def main():
    all_examples = []
    generators = [
        gen_single_college,
        gen_multi_college,
        gen_three_colleges,
        gen_gender_count,
        gen_gender_split,
        gen_new_old,
        gen_college_gender,
        gen_college_new_old,
        gen_college_gender_new,
        gen_multi_group_mixed,
        gen_conflict,
        gen_priority,
        gen_combined_global,
        gen_college_with_global,
        gen_confirm,
        gen_free_form,
        gen_tagalog_mixed,
        gen_height,
    ]

    for gen_fn in generators:
        batch = gen_fn()
        all_examples.extend(batch)
        print(f"  {gen_fn.__name__}: {len(batch)} examples")

    random.shuffle(all_examples)

    out_path = Path(__file__).parent / "semantic_training_data.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for text, json_str in all_examples:
            f.write(json.dumps({"text": text, "label": json_str}, ensure_ascii=False) + "\n")

    print(f"\n✅ Generated {len(all_examples)} examples → {out_path}")
    print("\nSample entries:")
    for text, json_str in random.sample(all_examples, 8):
        print(f"  IN:  {text}")
        print(f"  OUT: {json_str}")
        print()


if __name__ == "__main__":
    main()
