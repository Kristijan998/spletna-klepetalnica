export default {
  "name": "ChatMessage",
  "type": "object",
  "properties": {
    "room_id": {
      "type": "string",
      "description": "ID sobe za pogovor"
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
    "file_url": {
      "type": "string",
      "description": "URL prilo\u017eene datoteke"
    },
    "file_name": {
      "type": "string",
      "description": "Ime prilo\u017eene datoteke"
    },
    "image_url": {
      "type": "string",
      "description": "URL slike (iz kamere ali nalo\u017eene)"
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
    "room_id",
    "sender_profile_id"
  ]
};