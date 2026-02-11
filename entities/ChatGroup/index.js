export default {
  "name": "ChatGroup",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Ime skupine"
    },
    "description": {
      "type": "string",
      "description": "Opis skupine"
    },
    "creator_profile_id": {
      "type": "string",
      "description": "ID profila ustvarjalca"
    },
    "creator_name": {
      "type": "string",
      "description": "Ime ustvarjalca"
    },
    "member_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "ID-ji \u010dlanov skupine"
    },
    "member_count": {
      "type": "number",
      "default": 1,
      "description": "\u0160tevilo \u010dlanov"
    },
    "is_public": {
      "type": "boolean",
      "default": true,
      "description": "Ali je skupina javna"
    },
    "avatar_color": {
      "type": "string",
      "description": "Barva ikone skupine"
    }
  },
  "required": [
    "name",
    "creator_profile_id"
  ]
};