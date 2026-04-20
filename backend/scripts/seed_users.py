"""
Seed script — generates N realistic mock Czech users with pet photos.

Run inside the backend container:
    docker exec -it petmatch-backend-1 python scripts/seed_users.py

Options:
    --count=120     number of users to create (default 20)
    --photos=2      photos per user (default 2)
    --clean         wipe all seed_mock_ users first, then re-seed
    --wipe-real     wipe ALL non-seed users (your real test accounts etc.)
    --wipe-all      wipe EVERY user including seed users (full reset)
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
from itertools import product

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

SEED_TAG = "seed_mock_"

# ---------------------------------------------------------------------------
# Czech diacritics → ASCII
# ---------------------------------------------------------------------------
_CZECH = {
    'á':'a','é':'e','ě':'e','í':'i','ó':'o','ú':'u','ů':'u','ý':'y',
    'č':'c','ď':'d','ň':'n','ř':'r','š':'s','ť':'t','ž':'z',' ':'_',
    'Á':'a','É':'e','Ě':'e','Í':'i','Ó':'o','Ú':'u','Ů':'u','Ý':'y',
    'Č':'c','Ď':'d','Ň':'n','Ř':'r','Š':'s','Ť':'t','Ž':'z',
}
def to_ascii(s: str) -> str:
    return "".join(_CZECH.get(c, c) for c in s).lower()

# ---------------------------------------------------------------------------
# Component pools
# ---------------------------------------------------------------------------

FEMALE_NAMES = [
    "Tereza","Lucie","Karolína","Veronika","Anežka","Simona","Barbora",
    "Eva","Nikola","Markéta","Petra","Jana","Kateřina","Monika","Lenka",
    "Adéla","Renata","Michaela","Zuzana","Kristýna","Eliška","Natálie",
    "Dominika","Gabriela","Alžběta","Šárka","Ivana","Radka","Dagmar","Hana",
]

MALE_NAMES = [
    "Jakub","Martin","Tomáš","Ondřej","Petr","Radek","Michal","Filip",
    "Lukáš","Stanislav","Jan","Pavel","Jiří","Miroslav","Zdeněk","Vojtěch",
    "Marek","Daniel","Václav","Roman","Patrik","Libor","Ladislav","Antonín",
    "Vladimír","Jaroslav","Kamil","Rostislav","Radoslav","Aleš",
]

FEMALE_SURNAMES = [
    "Nováková","Procházková","Horáková","Kopecká","Chaloupková","Dušková",
    "Zemanová","Nováčková","Vlčková","Benešová","Marková","Veselá",
    "Krejčová","Blažková","Pospíšilová","Hrubá","Kratochvílová","Jelínková",
    "Šimánková","Poláková","Fialová","Bartošová","Dvořáková","Čermáková",
    "Rezková","Machová","Říhová","Součková","Urbanová","Konečná",
]

MALE_SURNAMES = [
    "Svoboda","Dvořák","Kratochvíl","Blažek","Polák","Fiala","Krejčí",
    "Jelínek","Šimánek","Marek","Novák","Procházka","Horák","Kopec",
    "Chaloupka","Dušek","Zeman","Vlček","Beneš","Veselý","Pospíšil",
    "Hrubý","Bartošek","Čermák","Rezek","Mach","Říha","Souček","Urban",
    "Konečný",
]

CITIES = [
    ("Prague",           50.0755, 14.4378),
    ("Prague",           50.0869, 14.4213),
    ("Prague",           50.0600, 14.4650),
    ("Brno",             49.1951, 16.6068),
    ("Ostrava",          49.8209, 18.2625),
    ("Plzeň",            49.7477, 13.3776),
    ("Liberec",          50.7663, 15.0543),
    ("Olomouc",          49.5938, 17.2509),
    ("Pardubice",        50.0343, 15.7812),
    ("České Budějovice", 48.9745, 14.4744),
    ("Hradec Králové",   50.2092, 15.8328),
    ("Zlín",             49.2254, 17.6672),
    ("Kladno",           50.1474, 14.1034),
    ("Most",             50.5027, 13.6361),
    ("Opava",            49.9382, 17.9027),
    ("Frýdek-Místek",    49.6823, 18.3647),
    ("Karviná",          49.8564, 18.5432),
    ("Jihlava",          49.3961, 15.5875),
    ("Teplice",          50.6404, 13.8249),
    ("Děčín",            50.7740, 14.2130),
]

OCCUPATIONS = [
    "Software Engineer","Graphic Designer","Veterinarian","Teacher","Marketing Manager",
    "Photographer","Student","Electrician","Nurse","Chef","Accountant","Civil Engineer",
    "Pharmacist","Police Officer","Social Worker","Entrepreneur","Biologist","Mechanic",
    "IT Consultant","Architect","Doctor","Lawyer","Journalist","Data Analyst","HR Manager",
    "Sales Manager","Product Manager","UX Designer","Dentist","Physiotherapist",
    "Personal Trainer","Event Planner","Real Estate Agent","Financial Advisor","Barista",
]

EDUCATIONS = [
    "University","University","University","High School","Trade School","High School",
]

BIOS_FEMALE = [
    "Cat mom x2 🐱 Love hiking and good coffee.",
    "Vet student who fosters kittens 🐾",
    "Two dogs and a chaotic apartment 🐕🐕",
    "Rabbit whisperer 🐇 Also obsessed with anime.",
    "Night-shift nurse, day-time cat lady 🌙",
    "Border collie mom. Very competitive 😄",
    "Obsessed with my hamsters 🐹 and music.",
    "Rescue volunteer. Currently fostering 3 cats.",
    "Field researcher & proud dog pack leader 🐺",
    "Pharmacy student & kitten foster carer 🐱",
    "My golden retriever is my therapist 🐶",
    "Weekend hiker with my two huskies. Coffee addict.",
    "Poodle mom, yoga enthusiast, bad cook 🍳",
    "Animal shelter volunteer every Saturday 🐾",
    "Corgi owner. Will talk about my dog for hours.",
    "Cat behaviour nerd. Yes, they have feelings.",
    "Three cats named after planets. No regrets.",
    "Dog agility trainer on weekends 🏆",
    "Ferret mum. They're basically tiny chaos agents.",
    "Proud parrot owner. He knows 40 words 🦜",
]

BIOS_MALE = [
    "Golden retriever dad. Hike every weekend.",
    "Proud owner of a grumpy Persian cat 😸",
    "Travel photographer. My dog is my co-pilot.",
    "Labrador dad. Into cars and long walks.",
    "Cook by day, dog trainer by night 🐶",
    "Two cats, one dog, zero regrets.",
    "Gamer who also has a very spoiled cat.",
    "K9 unit handler. Dogs are people too.",
    "Built a startup. My dachshund is the CEO.",
    "My beagle is my alarm clock. Not by choice.",
    "Weekend hiker. My husky sets the pace.",
    "Cat person pretending to be a dog person.",
    "Rescued a greyhound. He rescued me back.",
    "Three dogs. Somehow the house is still standing.",
    "Vet tech by day. Cat dad by night 🌙",
    "Training my border collie for competitions 🏆",
    "My aquarium has more fish than I have friends.",
    "Tortoise owner. Patience is a virtue.",
    "Ex-military, now a gentle giant with a big dog.",
    "Two cats, a guitar, and too much coffee ☕",
]

RELATIONSHIP_GOALS = list(RelationshipGoalType)
SMOKING_CHOICES = [SmokingType.never]*5 + [SmokingType.occasionally]
DRINKING_CHOICES = [DrinkingType.never]*2 + [DrinkingType.occasionally]*3 + [DrinkingType.regularly]

# ---------------------------------------------------------------------------
# Photo fetching
# ---------------------------------------------------------------------------

_DOG_BREEDS = [
    "labrador","golden","husky","poodle","beagle","boxer","corgi",
    "dachshund","shiba","akita","dalmatian","chihuahua","maltese",
    "australian-shepherd","bernese",
]

def fetch_pet_photo_url() -> str:
    breed = random.choice(_DOG_BREEDS)
    try:
        with urllib.request.urlopen(
            f"https://dog.ceo/api/breed/{breed}/images/random", timeout=10
        ) as r:
            data = json.loads(r.read())
        if data.get("status") == "success":
            return data["message"]
    except Exception:
        pass
    with urllib.request.urlopen(
        "https://dog.ceo/api/breeds/image/random", timeout=10
    ) as r:
        return json.loads(r.read())["message"]

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
        print(f"    ⚠  {e}")
        return False

def make_thumbnail(src: Path, dest: Path):
    try:
        from PIL import Image
        img = Image.open(src)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((300, 300))
        img.save(dest)
    except Exception:
        pass

def save_photo(user_id: int) -> tuple | None:
    try:
        url = fetch_pet_photo_url()
    except Exception as e:
        print(f"    ⚠  Could not fetch URL: {e}")
        return None
    ext = Path(url.split("?")[0]).suffix or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    if not download_photo(url, dest):
        return None
    make_thumbnail(dest, UPLOAD_DIR / f"{dest.stem}_thumb{ext}")
    file_hash = hashlib.sha256(dest.read_bytes()).hexdigest()
    return f"/static/uploads/{filename}", file_hash

# ---------------------------------------------------------------------------
# User generator — produces unique (first, surname, gender) combinations
# ---------------------------------------------------------------------------

def generate_user_pool(n: int):
    """Yield n user dicts without repeating (first+surname) pairs."""
    female_pairs = list(product(FEMALE_NAMES, FEMALE_SURNAMES))
    male_pairs   = list(product(MALE_NAMES,   MALE_SURNAMES))
    random.shuffle(female_pairs)
    random.shuffle(male_pairs)

    fi = mi = 0
    for i in range(n):
        if i % 2 == 0 and fi < len(female_pairs):
            first, surname = female_pairs[fi]; fi += 1; gender = "female"
        elif mi < len(male_pairs):
            first, surname = male_pairs[mi];   mi += 1; gender = "male"
        else:
            first, surname = female_pairs[fi]; fi += 1; gender = "female"

        city, lat, lon = random.choice(CITIES)
        dob = date(
            random.randint(1990, 2003),
            random.randint(1, 12),
            random.randint(1, 28),
        )
        height = random.randint(158, 195) if gender == "male" else random.randint(155, 178)
        bios = BIOS_MALE if gender == "male" else BIOS_FEMALE
        yield {
            "first": first, "surname": surname, "gender": gender,
            "dob": dob, "city": city, "lat": lat + random.uniform(-0.05, 0.05),
            "lon": lon + random.uniform(-0.05, 0.05),
            "occupation": random.choice(OCCUPATIONS),
            "education": random.choice(EDUCATIONS),
            "bio": random.choice(bios),
            "height": height,
        }

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

def clean_seed_users(db):
    print("🧹 Removing existing seed users...")
    users = db.query(User).filter(User.username.like(f"{SEED_TAG}%")).all()
    for u in users:
        db.delete(u)
    db.commit()
    print(f"   Removed {len(users)} seed user(s).\n")

def _cleanup_fk_for(db, id_subquery_sql, params):
    """Remove or nullify rows that reference users being deleted."""
    for stmt in [
        # Delete rows where NOT NULL columns reference the target users
        f"DELETE FROM reports WHERE reporter_id IN ({id_subquery_sql}) OR reported_id IN ({id_subquery_sql})",
        f"DELETE FROM notifications WHERE related_user_id IN ({id_subquery_sql})",
        # Nullify nullable FK columns
        f"UPDATE matches SET unmatched_by = NULL WHERE unmatched_by IN ({id_subquery_sql})",
    ]:
        try:
            db.execute(text(stmt), params)
        except Exception:
            db.rollback()
            raise

def wipe_real_users(db):
    """Delete all non-seed users using raw SQL to respect FK constraints."""
    print("🗑  Wiping all real (non-seed) users...")
    subq = "SELECT id FROM users WHERE username NOT LIKE :prefix"
    params = {"prefix": f"{SEED_TAG}%"}
    _cleanup_fk_for(db, subq, params)
    result = db.execute(text(f"DELETE FROM users WHERE username NOT LIKE :prefix"), params)
    db.commit()
    print(f"   Removed {result.rowcount} real user(s).\n")

def wipe_all_users(db):
    """Delete every user — full reset."""
    print("💣 Wiping ALL users...")
    _cleanup_fk_for(db, "SELECT id FROM users", {})
    result = db.execute(text("DELETE FROM users"))
    db.commit()
    print(f"   Removed {result.rowcount} user(s).\n")

# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

def seed(db, count: int = 20, photos_per_user: int = 2):
    print(f"🌱 Creating {count} mock users ({photos_per_user} photo(s) each)...\n")
    created = skipped = 0

    for u in generate_user_pool(count):
        base = f"{to_ascii(u['first'])}_{to_ascii(u['surname'])[:6]}"
        username = f"{SEED_TAG}{base}"
        email    = f"{username}@petmatch.test"

        # Make username unique if collision
        suffix = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{SEED_TAG}{base}_{suffix}"
            email    = f"{username}@petmatch.test"
            suffix  += 1
            if suffix > 9:
                skipped += 1
                break
        else:
            pass

        if db.query(User).filter(User.email == email).first():
            skipped += 1
            continue

        gender_enum = GenderType[u["gender"]]

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
        db.flush()

        wkt = f"SRID=4326;POINT({u['lon']} {u['lat']})"
        profile = UserProfile(
            user_id=user.id,
            first_name=u["first"],
            surname=u["surname"],
            date_of_birth=u["dob"],
            gender=gender_enum,
            bio=u["bio"],
            location_city=u["city"],
            location_country="Czech Republic",
            location=wkt,
            location_privacy=LocationPrivacyType.approximate,
            height_value=u["height"],
            height_unit=HeightUnitType.cm,
            education=u["education"],
            occupation=u["occupation"],
            relationship_goal=random.choice(RELATIONSHIP_GOALS),
            smoking=random.choice(SMOKING_CHOICES),
            drinking=random.choice(DRINKING_CHOICES),
        )
        db.add(profile)

        prefs = UserPreferences(
            user_id=user.id,
            min_age=18, max_age=45, max_distance=50,
            preferred_genders=[GenderType.male, GenderType.female,
                                GenderType.non_binary, GenderType.other],
            notify_likes=True, notify_matches=True, notify_messages=True,
        )
        db.add(prefs)
        db.commit()

        print(f"  [{created+1:>3}/{count}] {u['first']} {u['surname']} (@{username})", end="  ")

        for p in range(photos_per_user):
            print(f"📸", end=" ", flush=True)
            result = save_photo(user.id)
            if result:
                photo_url, file_hash = result
                db.add(UserPhoto(
                    user_id=user.id,
                    photo_url=photo_url,
                    is_primary=(p == 0),
                    photo_order=p,
                    file_hash=file_hash,
                    uploaded_at=datetime.utcnow(),
                ))
                db.commit()
                print("✅", end=" ", flush=True)
            else:
                print("❌", end=" ", flush=True)
        print()
        created += 1

    print(f"\n✅ Done — {created} created, {skipped} skipped.")
    print("   Password for all accounts : Test1234!")
    print(f"  Username prefix            : {SEED_TAG}")


if __name__ == "__main__":
    args       = sys.argv[1:]
    clean      = "--clean"      in args
    wipe_real  = "--wipe-real"  in args
    wipe_all   = "--wipe-all"   in args
    count      = next((int(a.split("=")[1]) for a in args if a.startswith("--count=")),  20)
    photos     = next((int(a.split("=")[1]) for a in args if a.startswith("--photos=")), 2)

    db = SessionLocal()
    try:
        if wipe_all:
            wipe_all_users(db)
        elif wipe_real:
            wipe_real_users(db)
        elif clean:
            clean_seed_users(db)
        seed(db, count=count, photos_per_user=photos)
    finally:
        db.close()
