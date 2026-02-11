export default {
  "name": "GroupMessage",
  "type": "object",
  "properties": {
    "group_id": {
      "type": "string",
      "description": "ID skupine"
    },
    "sender_profile_id": {
      "type": "string",
      "description": "ID profila po\u0161iljatelja"
    },
    "sender_name": {
      "type": "string",
      "description": "Ime po\u0161iljatelja"
    },
    "content": {
      "type": "string",
      "description": "Vsebina sporo\u010dila"
    },
    "image_url": {
      "type": "string",
      "description": "URL slike"
    },
    "read_by": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "ID-ji uporabnikov, ki so prebrali sporo\u010dilo"
    },
    "read_at": {
      "type": "string",
      "format": "date-time",
      "description": "\u010cas, ko je bilo sporo\u010dilo prebrano"
    }
  },
  "required": [
    "group_id",
    "sender_profile_id",
    "content"
  ]
};