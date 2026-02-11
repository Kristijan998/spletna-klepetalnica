export default {
  "name": "ChatRoom",
  "type": "object",
  "properties": {
    "participant_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "ID-ji profilov udele\u017eencev"
    },
    "participant_names": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Imena udele\u017eencev"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "ended"
      ],
      "default": "active",
      "description": "Status sobe"
    },
    "last_message": {
      "type": "string",
      "description": "Zadnje sporo\u010dilo v sobi"
    }
  },
  "required": [
    "participant_ids",
    "status"
  ]
};