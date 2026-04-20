"""
Seed script — creates 20 realistic mock users with pet photos.

Run inside the backend container:
    docker exec -it petmatch-backend-1 python scripts/seed_users.py

Or with --clean to wipe all seed users first:
    docker exec -it petmatch-backend-1 python scripts/seed_users.py --clean
"""

import sys
import os
import uuid
import hashlib
import urllib.request
import json
import random
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, "/app")

from sqlalchemy import text
from app.infrastructure.database import db as _db
SessionLocal = _db.SessionLocal
from app.domain.models import User, UserProfile, UserPhoto, UserPreferences
from app.domain.enums import (
    GenderType, RelationshipGoalType, SmokingType, DrinkingType,
    UserStatusType, SubscriptionTierType, LocationPrivacyType, HeightUnitType
)
from app.core.security import get_password_hash

UPLOAD_DIR = Path("/app/static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SEED_TAG = "seed_mock_"  # prefix on all seed usernames for easy cleanup

_CZECH = {
    'á':'a','é':'e','ě':'e','í':'i','ó':'o','ú':'u','ů':'u','ý':'y',
    'č':'c','ď':'d','ň':'n','ř':'r','š':'s','ť':'t','ž':'z',' ':'_',
    'Á':'a','É':'e','Ě':'e','Í':'i','Ó':'o','Ú':'u','Ů':'u','Ý':'y',
    'Č':'c','Ď':'d','Ň':'n','Ř':'r','Š':'s','Ť':'t','Ž':'z',
}

def to_ascii(s: str) -> str:
    return "".join(_CZECH.get(c, c) for c in s).lower()

# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

USERS = [
    # (first_name, surname, gender, dob, city, lat, lon, occupation, education, bio, height)
    ("Tereza",   "Nováková",   "female", date(1998, 3, 14), "Prague",  50.0755, 14.4378, "Graphic Designer",    "University",        "Cat mom x2 🐱 Love hiking and good coffee.", 168),
    ("Jakub",    "Svoboda",    "male",   date(1995, 7, 22), "Prague",  50.0800, 14.4200, "Software Engineer",   "University",        "Golden retriever dad. Hike every weekend.", 182),
    ("Lucie",    "Procházková","female", date(2000, 1, 8),  "Brno",    49.1951, 16.6068, "Veterinarian",        "University",        "Vet student who fosters kittens 🐾",        162),
    ("Martin",   "Dvořák",     "male",   date(1993, 11, 30),"Brno",    49.2000, 16.6100, "Teacher",             "University",        "Proud owner of a grumpy Persian cat 😸",   175),
    ("Karolína", "Horáková",   "female", date(1997, 5, 19), "Ostrava", 49.8209, 18.2625, "Marketing Manager",   "University",        "Two dogs and a chaotic apartment 🐕🐕",    170),
    ("Tomáš",    "Kratochvíl", "male",   date(1996, 9, 3),  "Ostrava", 49.8300, 18.2700, "Photographer",        "High School",       "Travel photographer. My dog is my co-pilot.", 179),
    ("Anežka",   "Benešová",   "female", date(2001, 12, 25),"Plzeň",   49.7477, 13.3776, "Student",             "High School",       "Rabbit whisperer 🐇 Also obsessed with anime.", 160),
    ("Ondřej",   "Marek",      "male",   date(1994, 4, 17), "Plzeň",   49.7500, 13.3800, "Electrician",         "Trade School",      "Labrador dad. Into cars and long walks.",   183),
    ("Veronika", "Kopecká",    "female", date(1999, 8, 6),  "Liberec", 50.7663, 15.0543, "Nurse",               "University",        "Night-shift nurse, day-time cat lady 🌙",   165),
    ("Petr",     "Blažek",     "male",   date(1992, 2, 28), "Liberec", 50.7700, 15.0600, "Chef",                "Trade School",      "Cook by day, dog trainer by night 🐶",     177),
    ("Simona",   "Chaloupková","female", date(1998, 10, 11),"Olomouc", 49.5938, 17.2509, "Accountant",          "University",        "Border collie mom. Very competitive 😄",    167),
    ("Radek",    "Šimánek",    "male",   date(1990, 6, 15), "Olomouc", 49.5900, 17.2550, "Civil Engineer",      "University",        "Two cats, one dog, zero regrets.",          180),
    ("Barbora",  "Dušková",    "female", date(2002, 3, 29), "Pardubice",50.0343, 15.7812,"Student",             "High School",       "Obsessed with my hamsters 🐹 and music.",   158),
    ("Michal",   "Polák",      "male",   date(1997, 1, 5),  "Pardubice",50.0400, 15.7850,"IT Consultant",       "University",        "Gamer who also has a very spoiled cat.",    176),
    ("Eva",      "Vlčková",    "female", date(1996, 7, 31), "České Budějovice",48.9745,14.4744,"Biologist","University","Field researcher & proud dog pack leader 🐺", 163),
    ("Lukáš",    "Fiala",      "male",   date(1991, 5, 20), "České Budějovice",48.9800,14.4800,"Mechanic","Trade School","Weekend hiker. My beagle is my alarm clock.", 181),
    ("Nikola",   "Zemanová",   "female", date(2000, 11, 17),"Hradec Králové",50.2092,15.8328,"Pharmacist","University","Pharmacy student & kitten foster carer 🐱", 166),
    ("Filip",    "Krejčí",     "male",   date(1994, 8, 9),  "Hradec Králové",50.2100,15.8400,"Police Officer","High School","K9 unit handler. Dogs are people too.",   178),
    ("Markéta",  "Nováčková",  "female", date(1999, 4, 23), "Zlín",    49.2254, 17.6672, "Social Worker",       "University",        "Rescue volunteer. Currently fostering 3 cats.", 164),
    ("Stanislav","Jelínek",    "male",   date(1988, 12, 1), "Zlín",    49.2300, 17.6700, "Entrepreneur",        "University",        "Built a startup. My dachshund is the CEO.", 174),
]

RELATIONSHIP_GOALS = [
    RelationshipGoalType.relationship,
    RelationshipGoalType.friendship,
    RelationshipGoalType.casual,
    RelationshipGoalType.undecided,
]

SMOKING = [SmokingType.never, SmokingType.never, SmokingType.never, SmokingType.occasionally]
DRINKING = [DrinkingType.never, DrinkingType.occasionally, DrinkingType.occasionally, DrinkingType.regularly]

# ---------------------------------------------------------------------------
# Photo sources — free, no-auth pet photo APIs
# ---------------------------------------------------------------------------

def fetch_dog_url() -> str:
    with urllib.request.urlopen("https://dog.ceo/api/breeds/image/random", timeout=10) as r:
        return json.loads(r.read())["message"]

# Fallback static dog breeds when cat API rate-limits
_DOG_BREEDS = [
    "labrador", "golden", "husky", "poodle", "beagle",
    "boxer", "corgi", "dachshund", "shiba", "akita",
]

def fetch_cat_url() -> str:
    breed = random.choice(_DOG_BREEDS)
    with urllib.request.urlopen(f"https://dog.ceo/api/breed/{breed}/images/random", timeout=10) as r:
        data = json.loads(r.read())
    if data.get("status") == "success":
        return data["message"]
    # fallback to any random dog
    return fetch_dog_url()

def download_photo(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PetMatchSeed/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        if len(data) < 1000:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"    ⚠ Could not download {url}: {e}")
        return False

def make_thumbnail(src: Path, dest: Path):
    try:
        from PIL import Image
        img = Image.open(src)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((300, 300))
        img.save(dest)
    except Exception as e:
        print(f"    ⚠ Thumbnail failed: {e}")

def save_photo_for_user(user_id: int, photo_index: int, gender: str) -> tuple[str, str] | None:
    """Download a pet photo, save to disk, return (photo_url, file_hash) or None."""
    try:
        # Alternate cats/dogs loosely by index for variety
        if photo_index % 2 == 0:
            url = fetch_dog_url()
        else:
            url = fetch_cat_url()
    except Exception as e:
        print(f"    ⚠ Could not fetch photo URL: {e}")
        return None

    ext = Path(url.split("?")[0]).suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"

    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    thumb_dest = UPLOAD_DIR / f"{dest.stem}_thumb{ext}"

    if not download_photo(url, dest):
        return None

    make_thumbnail(dest, thumb_dest)

    file_hash = hashlib.sha256(dest.read_bytes()).hexdigest()
    photo_url = f"/static/uploads/{filename}"
    return photo_url, file_hash

# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

def clean_seed_users(db):
    print("🧹 Removing existing seed users...")
    users = db.query(User).filter(User.username.like(f"{SEED_TAG}%")).all()
    for u in users:
        db.delete(u)
    db.commit()
    print(f"   Removed {len(users)} seed user(s).")

def seed(db, num_photos_per_user: int = 2):
    print(f"\n🌱 Seeding {len(USERS)} mock users ({num_photos_per_user} photos each)...\n")

    created = 0
    for i, (first, surname, gender_str, dob, city, lat, lon,
            occupation, education, bio, height) in enumerate(USERS):

        username = f"{SEED_TAG}{to_ascii(first)}_{to_ascii(surname)[:6]}"
        email = f"{username}@petmatch.test"

        # Skip if already exists
        if db.query(User).filter(User.username == username).first():
            print(f"  ⏭  {username} already exists, skipping.")
            continue

        gender = GenderType[gender_str]

        # -- User --
        user = User(
            email=email,
            username=username,
            password_hash=get_password_hash("Test1234!"),
            status=UserStatusType.active,
            is_verified=True,
            subscription_tier=SubscriptionTierType.free,
            created_at=datetime.utcnow(),
            last_active=datetime.utcnow(),
        )
        db.add(user)
        db.flush()  # get user.id without committing

        # -- Profile --
        wkt_point = f"SRID=4326;POINT({lon} {lat})"
        profile = UserProfile(
            user_id=user.id,
            first_name=first,
            surname=surname,
            date_of_birth=dob,
            gender=gender,
            bio=bio,
            location_city=city,
            location_country="Czech Republic",
            location=wkt_point,
            location_privacy=LocationPrivacyType.approximate,
            height_value=height,
            height_unit=HeightUnitType.cm,
            education=education,
            occupation=occupation,
            relationship_goal=random.choice(RELATIONSHIP_GOALS),
            smoking=random.choice(SMOKING),
            drinking=random.choice(DRINKING),
        )
        db.add(profile)

        # -- Preferences --
        all_genders = [GenderType.male, GenderType.female, GenderType.non_binary, GenderType.other]
        prefs = UserPreferences(
            user_id=user.id,
            min_age=20,
            max_age=40,
            max_distance=50,
            preferred_genders=all_genders,
            notify_likes=True,
            notify_matches=True,
            notify_messages=True,
        )
        db.add(prefs)
        db.commit()

        # -- Photos --
        print(f"  👤 {first} {surname} ({username})")
        for p in range(num_photos_per_user):
            print(f"     📸 Downloading photo {p+1}/{num_photos_per_user}...", end=" ", flush=True)
            result = save_photo_for_user(user.id, i + p, gender_str)
            if result:
                photo_url, file_hash = result
                photo = UserPhoto(
                    user_id=user.id,
                    photo_url=photo_url,
                    is_primary=(p == 0),
                    photo_order=p,
                    file_hash=file_hash,
                    uploaded_at=datetime.utcnow(),
                )
                db.add(photo)
                db.commit()
                print("✅")
            else:
                print("❌ skipped")

        created += 1

    print(f"\n✅ Done! Created {created} mock users.")
    print("   Password for all: Test1234!")
    print(f"   Username format: {SEED_TAG}<firstname>_<surname>")


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    photos = 2
    for arg in sys.argv[1:]:
        if arg.startswith("--photos="):
            photos = int(arg.split("=")[1])

    db = SessionLocal()
    try:
        if clean:
            clean_seed_users(db)
        seed(db, num_photos_per_user=photos)
    finally:
        db.close()
