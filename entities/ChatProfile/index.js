export default {
  "name": "ChatProfile",
  "type": "object",
  "properties": {
    "display_name": {
      "type": "string",
      "description": "Ime uporabnika za prikaz"
    },
    "birth_year": {
      "type": "number",
      "description": "Letnica rojstva"
    },
    "gender": {
      "type": "string",
      "enum": [
        "mo\u0161ki",
        "\u017eenska",
        "drugo"
      ],
      "description": "Spol"
    },
    "country": {
      "type": "string",
      "description": "Dr\u017eava"
    },
    "city": {
      "type": "string",
      "description": "Mesto"
    },
    "bio": {
      "type": "string",
      "description": "Kratek opis profila"
    },
    "is_online": {
      "type": "boolean",
      "default": false,
      "description": "Ali je uporabnik trenutno na voljo za klepet"
    },
    "is_guest": {
      "type": "boolean",
      "default": true,
      "description": "Ali je uporabnik gost (brez Google prijave)"
    },
    "session_id": {
      "type": "string",
      "description": "Unikaten ID seje za goste"
    },
    "avatar_color": {
      "type": "string",
      "description": "Barva avatarja"
    },
    "avatar_url": {
      "type": "string",
      "description": "URL slike profila"
    },
    "gallery_images": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Galerija slik uporabnika"
    },
    "last_activity": {
      "type": "string",
      "format": "date-time",
      "description": "\u010cas zadnje aktivnosti"
    },
    "is_typing": {
      "type": "boolean",
      "default": false,
      "description": "Ali je uporabnik trenutno pi\u0161e sporo\u010dilo"
    },
    "blocked_users": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "ID-ji blokiranih uporabnikov"
    }
  },
  "required": [
    "display_name",
    "birth_year",
    "gender"
  ]
};