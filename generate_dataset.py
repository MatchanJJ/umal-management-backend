import pandas as pd
import random

# Define the base data
days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
time_blocks = ["Morning", "Afternoon"]
roles = [
    "Career Guidance",
    "Ushering",
    "Photoshoot Appearance",
    "Video Appearance",
    "Campus Tour",
    "Program Assistance",
    "Event Setup"
]

# Create varied natural language templates
templates = [
    # Direct needs
    "Need {slots} volunteers on {day} {time} for {role}.",
    "Need {slots} members {day} {time} for {role}.",
    "Looking for {slots} volunteers this {day} {time} for {role}.",
    "Looking for {slots} members this {day} {time} for {role}.",
    "Requesting {slots} volunteers {day} {time} for {role}.",
    "Requesting {slots} members {day} {time} for {role}.",
    
    # Assignment style
    "Assign {slots} volunteers {day} {time} for {role}.",
    "Assign {slots} students {day} {time} for {role}.",
    "Schedule {slots} volunteers for {role} on {day} {time}.",
    "Schedule {slots} members for {role} this {day} {time}.",
    
    # Seeking/searching
    "Seeking {slots} volunteers for {role} {day} {time}.",
    "Searching for {slots} members to help with {role} on {day} {time}.",
    "We're looking for {slots} volunteers to assist with {role} this {day} {time}.",
    
    # Requirement statements
    "We need {slots} representatives for {role} on {day} {time}.",
    "We require {slots} volunteers for {role} this {day} {time}.",
    "Required: {slots} volunteers for {role} on {day} {time}.",
    "{slots} volunteers needed for {role} {day} {time}.",
    "{slots} members needed this {day} {time} for {role}.",
    
    # Context-heavy variations
    "Need {slots} volunteers on {day} {time} for SHS {role}.",
    "Looking for {slots} members to help with {role} during SHS visit {day} {time}.",
    "Requesting {slots} volunteers for {role} at the outreach event {day} {time}.",
    "We need {slots} students for {role} during the SHS program {day} {time}.",
    
    # Casual variations
    "Can we get {slots} volunteers for {role} on {day} {time}?",
    "Who can do {role} on {day} {time}? Need {slots} people.",
    "{slots} volunteers please for {role} this {day} {time}.",
    "Get me {slots} volunteers for {role} on {day} {time}.",
    
    # Conversational
    "I need {slots} volunteers to handle {role} on {day} {time}.",
    "We're gonna need {slots} people for {role} this {day} {time}.",
    "Can you assign {slots} volunteers for {role} {day} {time}?",
    "Please schedule {slots} members for {role} on {day} {time}.",
    
    # Urgent/specific
    "Urgent: need {slots} volunteers for {role} {day} {time}.",
    "ASAP: {slots} volunteers needed for {role} on {day} {time}.",
    "For {day} {time}: need {slots} volunteers for {role}.",
    "{day} {time} - need {slots} volunteers for {role}.",
    
    # Activity-focused
    "Need {slots} volunteers to help with {role} on {day} {time}.",
    "Looking for {slots} members to assist in {role} this {day} {time}.",
    "Requesting {slots} volunteers to support {role} {day} {time}.",
    "We need {slots} people to handle {role} on {day} {time}.",
    
    # Event context
    "For the SHS event {day} {time}, need {slots} volunteers for {role}.",
    "Upcoming {day} {time} - need {slots} volunteers for {role}.",
    "Next {day} {time}: looking for {slots} volunteers for {role}.",
    "This {day} {time} we need {slots} volunteers for {role}.",
    
    # Question format
    "Who's available {day} {time} for {role}? Need {slots} volunteers.",
    "Anyone free {day} {time}? Need {slots} people for {role}.",
    "Can {slots} volunteers help with {role} on {day} {time}?",
    
    # Abbreviated/casual
    "{slots} ppl needed for {role} {day} {time}.",
    "Need {slots} ppl {day} {time} for {role}.",
    "{slots}x volunteers for {role} on {day} {time}.",
    
    # Professional tone
    "Volunteer request: {slots} members for {role} on {day} {time}.",
    "Assignment needed: {slots} volunteers for {role} this {day} {time}.",
    "Staffing requirement: {slots} volunteers for {role} {day} {time}.",
    
    # Mixed formats
    "{role} on {day} {time} - need {slots} volunteers.",
    "{role}: need {slots} volunteers {day} {time}.",
    "{day} {time} {role} - {slots} volunteers needed.",
    "For {role}, we need {slots} volunteers on {day} {time}.",
]

# Additional role-specific context
role_contexts = {
    "Career Guidance": ["session", "talk", "counseling", "advising"],
    "Ushering": ["guests", "visitors", "attendees", "crowd"],
    "Photoshoot Appearance": ["photos", "pictures", "shoot", "promotional materials"],
    "Video Appearance": ["video", "promo video", "recording", "filming"],
    "Campus Tour": ["tour", "campus walkthrough", "facility tour", "showing campus"],
    "Program Assistance": ["event", "program", "activity", "support"],
    "Event Setup": ["setup", "preparation", "arrangements", "organizing"]
}

def generate_contextual_text(slots, day, time_lower, role):
    """Generate additional contextual variations"""
    contexts = []
    
    # Basic with context
    if role in role_contexts:
        context_word = random.choice(role_contexts[role])
        contexts.extend([
            f"Need {slots} volunteers for {context_word} - {role} on {day} {time_lower}.",
            f"Looking for {slots} members to help with {context_word} ({role}) this {day} {time_lower}.",
            f"{slots} volunteers needed for {role} {context_word} {day} {time_lower}.",
        ])
    
    return random.choice(contexts) if contexts else None

# Generate dataset
data = []
target_rows = 450  # Generate 450 rows

for _ in range(target_rows):
    slots = random.randint(1, 10)
    day = random.choice(days)
    time_block = random.choice(time_blocks)
    role = random.choice(roles)
    
    # Randomly choose between template or contextual
    if random.random() < 0.15:  # 15% chance for contextual
        time_lower = time_block.lower()
        event_text = generate_contextual_text(slots, day, time_lower, role)
        if event_text is None:  # Fallback to template
            template = random.choice(templates)
            time_lower = time_block.lower()
            event_text = template.format(slots=slots, day=day, time=time_lower, role=role)
    else:
        template = random.choice(templates)
        time_lower = time_block.lower()
        event_text = template.format(slots=slots, day=day, time=time_lower, role=role)
    
    # Random capitalization variations
    if random.random() < 0.1:  # 10% lowercase day
        event_text = event_text.replace(day, day.lower())
    
    data.append({
        'event_text': event_text,
        'day': day,
        'time_block': time_block,
        'slots_needed': slots,
        'role': role
    })

# Create DataFrame
df = pd.DataFrame(data)

# Shuffle the dataset
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# Save to CSV
output_file = 'assignai_training_dataset.csv'
df.to_csv(output_file, index=False, encoding='utf-8')

print(f"✅ Dataset generated successfully!")
print(f"📊 Total rows: {len(df)}")
print(f"📁 Saved as: {output_file}")
print(f"\n📈 Dataset Statistics:")
print(f"   Days distribution:")
for day in days:
    count = len(df[df['day'] == day])
    print(f"      {day}: {count} rows")
print(f"\n   Time blocks distribution:")
for time in time_blocks:
    count = len(df[df['time_block'] == time])
    print(f"      {time}: {count} rows")
print(f"\n   Roles distribution:")
for role in roles:
    count = len(df[df['role'] == role])
    print(f"      {role}: {count} rows")
print(f"\n   Slots needed range: {df['slots_needed'].min()} - {df['slots_needed'].max()}")
print(f"   Average slots needed: {df['slots_needed'].mean():.2f}")

# Show sample rows
print(f"\n📝 Sample rows:")
print(df.head(10).to_string(index=False))
