from __future__ import annotations

from datetime import datetime, date
from pathlib import Path
from typing import Optional, List
import json
import secrets
import time

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = Path(__file__).resolve().parent / "db.json"


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def normalize_email(value: str) -> str:
    return value.strip().lower()


def make_id(prefix: Optional[str] = None) -> str:
    suffix = f"{int(time.time() * 1000)}-{secrets.token_hex(3)}"
    return f"{prefix}-{suffix}" if prefix else suffix


def ensure_db() -> None:
    if DB_PATH.exists():
        return
    created_at = now_iso()
    db = {
        "users": [
            {
                "id": "1",
                "email": "admin@example.com",
                "password": "admin123",
                "role": "admin",
                "createdAt": created_at,
            },
            {
                "id": "2",
                "email": "user@example.com",
                "password": "user123",
                "role": "user",
                "createdAt": created_at,
            },
        ],
        "venues": [],
        "rooms": [],
        "bookings": [],
        "memberships": [],
        "invitations": [],
    }
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")


def read_db() -> dict:
    ensure_db()
    raw = DB_PATH.read_text(encoding="utf-8")
    return json.loads(raw)


def write_db(db: dict) -> None:
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")


def to_public_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "password"}


def is_invitation_valid(invitation: dict) -> bool:
    if invitation.get("revokedAt"):
        return False
    expires_at = invitation.get("expiresAt")
    if expires_at:
        try:
            if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.utcnow():
                return False
        except ValueError:
            return False
    max_uses = invitation.get("maxUses")
    if max_uses is not None and invitation.get("uses", 0) >= max_uses:
        return False
    return True


def overlaps(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    return start_a < end_b and end_a > start_b


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class LoginPayload(BaseModel):
    email: str
    password: str


class RegisterPayload(BaseModel):
    email: str
    password: str
    role: str


class CreateUserPayload(BaseModel):
    email: str
    password: str
    role: Optional[str] = "user"
    firstName: Optional[str] = None
    lastName: Optional[str] = None


class VenueCreatePayload(BaseModel):
    name: str
    description: Optional[str] = ""
    address: str
    adminId: str


class VenueUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None


class RoomCreatePayload(BaseModel):
    venueId: str
    name: str
    capacity: int


class RoomUpdatePayload(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None


class BookingCreatePayload(BaseModel):
    roomId: str
    userId: str
    bookingDate: str
    startTime: str
    endTime: str


class InvitationCreatePayload(BaseModel):
    venueId: str
    venueName: str
    createdByUserId: str
    inviteeFirstName: str
    inviteeLastName: str
    inviteeEmail: str
    inviteeUserId: Optional[str] = None
    expiresAt: Optional[str] = None
    maxUses: Optional[int] = None


class InvitationUpdatePayload(BaseModel):
    expiresAt: Optional[str] = None
    maxUses: Optional[int] = None


class InvitationRedeemPayload(BaseModel):
    userId: str
    userEmail: Optional[str] = None


class MembershipCreatePayload(BaseModel):
    venueId: str
    userId: str
    role: Optional[str] = "member"
    invitationId: Optional[str] = None


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/auth/login")
def login(payload: LoginPayload):
    db = read_db()
    email = normalize_email(payload.email)
    user = next(
        (
            u
            for u in db["users"]
            if u["email"] == email and u["password"] == payload.password
        ),
        None,
    )
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return {"user": to_public_user(user)}


@app.post("/api/auth/register")
def register(payload: RegisterPayload):
    db = read_db()
    email = normalize_email(payload.email)
    if any(u["email"] == email for u in db["users"]):
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = {
        "id": make_id("user"),
        "email": email,
        "password": payload.password,
        "role": payload.role,
        "createdAt": now_iso(),
    }
    db["users"].append(user)
    write_db(db)
    return {"user": to_public_user(user)}


@app.post("/api/users")
def create_user(payload: CreateUserPayload):
    db = read_db()
    email = normalize_email(payload.email)
    existing = next((u for u in db["users"] if u["email"] == email), None)
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = {
        "id": make_id("user"),
        "email": email,
        "password": payload.password,
        "role": payload.role or "user",
        "firstName": payload.firstName.strip() if payload.firstName else None,
        "lastName": payload.lastName.strip() if payload.lastName else None,
        "createdAt": now_iso(),
    }
    db["users"].append(user)
    write_db(db)
    return {"user": to_public_user(user)}


@app.get("/api/users/by-email")
def get_user_by_email(email: str = Query(...)):
    db = read_db()
    normalized = normalize_email(email)
    user = next((u for u in db["users"] if u["email"] == normalized), None)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"user": to_public_user(user)}


@app.get("/api/venues")
def list_venues(adminId: Optional[str] = None, userId: Optional[str] = None):
    db = read_db()
    venues = db["venues"]
    if adminId:
        venues = [v for v in venues if v.get("adminId") == adminId]
    if userId:
        membership_venue_ids = {
            m["venueId"]
            for m in db["memberships"]
            if m.get("userId") == userId
        }
        venues = [v for v in venues if v.get("id") in membership_venue_ids]
    return {"venues": venues}


@app.post("/api/venues")
def create_venue(payload: VenueCreatePayload):
    db = read_db()
    venue = {
        "id": make_id("venue"),
        "name": payload.name.strip(),
        "description": payload.description or "",
        "address": payload.address.strip(),
        "adminId": payload.adminId,
        "createdAt": now_iso(),
    }
    db["venues"].append(venue)
    write_db(db)
    return {"venue": venue}


@app.patch("/api/venues/{venue_id}")
def update_venue(venue_id: str, payload: VenueUpdatePayload):
    db = read_db()
    venue = next((v for v in db["venues"] if v["id"] == venue_id), None)
    if not venue:
        raise HTTPException(status_code=404, detail="Заведение не найдено")
    if payload.name is not None:
        venue["name"] = payload.name
    if payload.description is not None:
        venue["description"] = payload.description
    if payload.address is not None:
        venue["address"] = payload.address
    write_db(db)
    return {"venue": venue}


@app.get("/api/rooms")
def list_rooms(venueId: Optional[str] = None, venueIds: Optional[str] = None):
    db = read_db()
    rooms = db["rooms"]
    if venueId:
        rooms = [r for r in rooms if r.get("venueId") == venueId]
    if venueIds:
        ids = {v.strip() for v in venueIds.split(",") if v.strip()}
        rooms = [r for r in rooms if r.get("venueId") in ids]
    return {"rooms": rooms}


@app.post("/api/rooms")
def create_room(payload: RoomCreatePayload):
    db = read_db()
    if not any(v["id"] == payload.venueId for v in db["venues"]):
        raise HTTPException(status_code=400, detail="Заведение не найдено")
    if payload.capacity < 1:
        raise HTTPException(status_code=400, detail="Вместимость должна быть больше 0")
    room = {
        "id": make_id("room"),
        "venueId": payload.venueId,
        "name": payload.name.strip(),
        "capacity": payload.capacity,
        "createdAt": now_iso(),
    }
    db["rooms"].append(room)
    write_db(db)
    return {"room": room}


@app.patch("/api/rooms/{room_id}")
def update_room(room_id: str, payload: RoomUpdatePayload):
    db = read_db()
    room = next((r for r in db["rooms"] if r["id"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if payload.name is not None:
        room["name"] = payload.name
    if payload.capacity is not None:
        if payload.capacity < 1:
            raise HTTPException(status_code=400, detail="Вместимость должна быть больше 0")
        room["capacity"] = payload.capacity
    write_db(db)
    return {"room": room}


@app.delete("/api/rooms/{room_id}")
def delete_room(room_id: str):
    db = read_db()
    room = next((r for r in db["rooms"] if r["id"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    db["rooms"] = [r for r in db["rooms"] if r["id"] != room_id]
    db["bookings"] = [b for b in db["bookings"] if b.get("roomId") != room_id]
    write_db(db)
    return {"success": True}


@app.get("/api/memberships")
def list_memberships(userId: Optional[str] = None, venueId: Optional[str] = None):
    db = read_db()
    memberships = db["memberships"]
    if userId:
        memberships = [m for m in memberships if m.get("userId") == userId]
    if venueId:
        memberships = [m for m in memberships if m.get("venueId") == venueId]
    return {"memberships": memberships}


@app.post("/api/memberships")
def create_membership(payload: MembershipCreatePayload):
    db = read_db()
    existing = next(
        (
            m
            for m in db["memberships"]
            if m.get("venueId") == payload.venueId and m.get("userId") == payload.userId
        ),
        None,
    )
    if existing:
        return {"membership": existing}
    membership = {
        "id": make_id("membership"),
        "venueId": payload.venueId,
        "userId": payload.userId,
        "role": payload.role or "member",
        "joinedAt": now_iso(),
        "invitationId": payload.invitationId,
    }
    db["memberships"].append(membership)
    write_db(db)
    return {"membership": membership}


@app.get("/api/invitations")
def list_invitations(venueId: Optional[str] = None):
    db = read_db()
    invitations = db["invitations"]
    if venueId:
        invitations = [inv for inv in invitations if inv.get("venueId") == venueId]
    return {"invitations": invitations}


@app.post("/api/invitations")
def create_invitation(payload: InvitationCreatePayload):
    db = read_db()
    invitation = {
        "id": make_id(f"{payload.venueId}-invite"),
        "venueId": payload.venueId,
        "venueName": payload.venueName,
        "token": secrets.token_hex(24),
        "createdByUserId": payload.createdByUserId,
        "inviteeUserId": payload.inviteeUserId,
        "inviteeFirstName": payload.inviteeFirstName.strip(),
        "inviteeLastName": payload.inviteeLastName.strip(),
        "inviteeEmail": normalize_email(payload.inviteeEmail),
        "createdAt": now_iso(),
        "expiresAt": payload.expiresAt,
        "maxUses": payload.maxUses if payload.maxUses is not None else 1,
        "uses": 0,
        "status": "pending",
    }
    db["invitations"].append(invitation)
    write_db(db)
    return {"invitation": invitation}


@app.get("/api/invitations/by-token/{token}")
def get_invitation_by_token(token: str):
    db = read_db()
    invitation = next((inv for inv in db["invitations"] if inv.get("token") == token), None)
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    return {"invitation": invitation}


@app.post("/api/invitations/by-token/{token}/redeem")
def redeem_invitation(token: str, payload: InvitationRedeemPayload):
    db = read_db()
    invitation = next((inv for inv in db["invitations"] if inv.get("token") == token), None)
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено или удалено")

    if invitation.get("inviteeUserId") and invitation.get("inviteeUserId") != payload.userId:
        raise HTTPException(status_code=400, detail="Приглашение предназначено для другого пользователя")

    if invitation.get("status") == "connected":
        if invitation.get("connectedUserId") == payload.userId:
            return {"success": True, "venueId": invitation["venueId"], "invitationId": invitation["id"]}
        raise HTTPException(status_code=400, detail="Приглашение уже использовано")

    if invitation.get("inviteeEmail") and payload.userEmail:
        if invitation.get("inviteeEmail") != normalize_email(payload.userEmail):
            raise HTTPException(status_code=400, detail="Приглашение предназначено для другого email")

    if not is_invitation_valid(invitation):
        raise HTTPException(status_code=400, detail="Приглашение недействительно")

    existing_membership = next(
        (
            m
            for m in db["memberships"]
            if m.get("venueId") == invitation["venueId"] and m.get("userId") == payload.userId
        ),
        None,
    )

    if not existing_membership:
        membership = {
            "id": make_id("membership"),
            "venueId": invitation["venueId"],
            "userId": payload.userId,
            "role": "member",
            "joinedAt": now_iso(),
            "invitationId": invitation["id"],
        }
        db["memberships"].append(membership)

    invitation["uses"] = invitation.get("uses", 0) + 1
    invitation["status"] = "connected"
    invitation["connectedAt"] = now_iso()
    invitation["connectedUserId"] = payload.userId
    write_db(db)

    return {"success": True, "venueId": invitation["venueId"], "invitationId": invitation["id"]}


@app.patch("/api/invitations/{invitation_id}")
def update_invitation(invitation_id: str, payload: InvitationUpdatePayload):
    db = read_db()
    invitation = next((inv for inv in db["invitations"] if inv.get("id") == invitation_id), None)
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if payload.expiresAt is not None:
        invitation["expiresAt"] = payload.expiresAt or None
    if payload.maxUses is not None:
        invitation["maxUses"] = payload.maxUses
    write_db(db)
    return {"invitation": invitation}


@app.post("/api/invitations/{invitation_id}/revoke")
def revoke_invitation(invitation_id: str):
    db = read_db()
    invitation = next((inv for inv in db["invitations"] if inv.get("id") == invitation_id), None)
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    invitation["revokedAt"] = now_iso()
    write_db(db)
    return {"invitation": invitation}


@app.get("/api/bookings")
def list_bookings(userId: Optional[str] = None, venueId: Optional[str] = None, roomId: Optional[str] = None):
    db = read_db()
    bookings = db["bookings"]
    if userId:
        bookings = [b for b in bookings if b.get("userId") == userId]
    if roomId:
        bookings = [b for b in bookings if b.get("roomId") == roomId]
    if venueId:
        room_ids = {r["id"] for r in db["rooms"] if r.get("venueId") == venueId}
        bookings = [b for b in bookings if b.get("roomId") in room_ids]
    return {"bookings": bookings}


@app.post("/api/bookings")
def create_booking(payload: BookingCreatePayload):
    db = read_db()
    room = next((r for r in db["rooms"] if r.get("id") == payload.roomId), None)
    if not room:
        raise HTTPException(status_code=400, detail="Комната не найдена")

    membership = next(
        (
            m
            for m in db["memberships"]
            if m.get("venueId") == room.get("venueId") and m.get("userId") == payload.userId
        ),
        None,
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Нет доступа к заведению")

    if payload.startTime >= payload.endTime:
        raise HTTPException(status_code=400, detail="Время окончания должно быть позже времени начала")

    try:
        booking_day = date.fromisoformat(payload.bookingDate)
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректная дата бронирования")

    if booking_day < date.today():
        raise HTTPException(status_code=400, detail="Нельзя бронировать на прошедшую дату")

    existing = [
        b
        for b in db["bookings"]
        if b.get("roomId") == payload.roomId
        and b.get("bookingDate") == payload.bookingDate
        and b.get("status") == "active"
    ]
    for booking in existing:
        if overlaps(payload.startTime, payload.endTime, booking["startTime"], booking["endTime"]):
            raise HTTPException(status_code=400, detail="Комната занята в выбранное время")

    booking = {
        "id": make_id("booking"),
        "roomId": payload.roomId,
        "userId": payload.userId,
        "bookingDate": payload.bookingDate,
        "startTime": payload.startTime,
        "endTime": payload.endTime,
        "status": "active",
        "createdAt": now_iso(),
    }
    db["bookings"].append(booking)
    write_db(db)
    return {"booking": booking}


@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str):
    db = read_db()
    booking = next((b for b in db["bookings"] if b.get("id") == booking_id), None)
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    booking["status"] = "cancelled"
    write_db(db)
    return {"booking": booking}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5174)
