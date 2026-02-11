export default {
  "name": "SupportMessage",
  "type": "object",
  "properties": {
    "sender_profile_id": {
      "type": "string",
      "description": "ID profila po\u0161iljatelja"
    },
    "sender_name": {
      "type": "string",
      "description": "Ime po\u0161iljatelja"
    },
    "subject": {
      "type": "string",
      "description": "Naslov sporo\u010dila"
    },
    "message": {
      "type": "string",
      "description": "Sporo\u010dilo"
    },
    "type": {
      "type": "string",
      "enum": [
        "predlog",
        "te\u017eava",
        "vpra\u0161anje",
        "drugo"
      ],
      "default": "predlog",
      "description": "Tip sporo\u010dila"
    }
  },
  "required": [
    "sender_profile_id",
    "sender_name",
    "subject",
    "message"
  ]
};