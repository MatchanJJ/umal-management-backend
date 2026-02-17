You are helping build a dataset for an NLP system called **AssignAI**, an Agentic NLP-Based Volunteer Scheduling and Assignment System.

### 🎯 Goal

Generate a **synthetic training dataset (CSV format)** that simulates how organization administrators request volunteers using natural language.

This dataset will be used to train an NLP model that extracts:

* Day of event
* Time block (Morning or Afternoon)
* Number of volunteers needed
* Role / activity assignment

---

### 📌 Context of the Organization

This is a **college organization** whose members conduct outreach and promotional activities for Senior High School (SHS) students.

The MAIN volunteer roles are:

1. Career Guidance
2. Ushering
3. Photoshoot Appearance
4. Video Appearance
5. Campus Tour
6. Program Assistance
7. Event Setup

These MUST be the only roles used in the dataset.

---

### 📊 Dataset Requirements

Generate **400–500 rows** with the following columns:

| Column Name  | Description                     |
| ------------ | ------------------------------- |
| event_text   | Natural language admin request  |
| day          | Extracted day (Monday–Saturday) |
| time_block   | Morning or Afternoon            |
| slots_needed | Integer (1–10 volunteers)       |
| role         | One of the 7 predefined roles   |

---

### 🧠 The `event_text` Must Sound Natural

Admins DO NOT speak in structured format.
Use varied phrasing such as:

* "Need 5 volunteers on Tuesday morning for campus tour."
* "Looking for 3 members this Friday afternoon for career guidance."
* "Assign 2 students Wednesday morning for ushering."
* "We need 6 representatives for video appearance on Thursday afternoon."
* "Requesting volunteers Saturday morning for SHS visit program assistance."

Important:
✔ Vary wording heavily
✔ Do NOT repeat sentence structures
✔ Randomize volunteer counts
✔ Mix capitalization and phrasing naturally
✔ Include SHS / outreach context occasionally
✔ Avoid robotic templates

---

### 📅 Allowed Values

Days:
Monday, Tuesday, Wednesday, Thursday, Friday, Saturday

Time Blocks:
Morning, Afternoon

Slots Needed:
Random integer from 1 to 10

---

### 📁 Output Format

Save as:

assignai_training_dataset.csv

Encoding: UTF-8
No index column.

---

### 🛠 Example Row (DO NOT COPY)

"Need 4 volunteers Monday morning for campus tour.",Monday,Morning,4,Campus Tour

---

### ❗Important

This dataset is for **training an intent + slot extraction model**, so linguistic variation is more important than perfect grammar.

Generate the CSV using Python (pandas).
