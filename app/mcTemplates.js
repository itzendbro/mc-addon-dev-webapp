
// Replaces every unique `UUidN` style token in a template with a freshly
// generated UUID v4, re-using the same generated value if the same token
// appears more than once in the template.
function fillUuidTokens(text) {
  const map = new Map();
  return text.replace(/UUid\d+/g, (token) => {
    if (!map.has(token)) map.set(token, uuidv4());
    return map.get(token);
  });
}

const MANIFEST_BP_TEMPLATE = `{
    "format_version": 2,
    "header": {
        "name": "pack.name",
        "description": "pack.description",
        "uuid": "UUid1",
        "version": [ 1, 0, 0 ],
        "min_engine_version": [ 1, 21, 70 ]
    },
    "modules": [
        {
            "description": "pack.description",
            "type": "data",
            "uuid": "UUid2",
            "version": [1, 0, 0]
        },
        {
            "type": "script",
            "language": "javascript",
            "uuid": "UUid3",
            "entry": "scripts/main.js",
            "version": [
                1,
                0,
                0
            ]
        }
    ],
    "capabilities": ["script_eval"],
    "dependencies": [
        {
            "uuid": "UUid4",
            "version": [1, 0, 0]
        },
        {
            "module_name": "@minecraft/server",
            "version": "1.19.0"
        },
        {
            "module_name": "@minecraft/server-ui",
            "version": "1.3.0"
        }
    ]
}`;

const MANIFEST_RP_TEMPLATE = `{
    "format_version": 2,
    "header": {
        "name": "pack.name",
        "description": "pack.description",
        "uuid": "UUid1",
        "version": [1,0,0],
        "min_engine_version": [1,21,100]
    },
    "modules": [
        {
            "type": "resources",
            "uuid": "UUid2",
            "version": [1,0,0]
        }
    ],
    "metadata": {
        "authors": ["Wonders studios"]
    },
    "subpacks": [
        {
            "folder_name": "folder A",
            "name": "sub pack name",
            "memory_tier": 1
        },
        {
            "folder_name": "folder B",
            "name": "sub pack name",
            "memory_tier": 2
        }
    ]
}`;

function buildManifestBP() {
  return fillUuidTokens(MANIFEST_BP_TEMPLATE);
}

function buildManifestRP() {
  return fillUuidTokens(MANIFEST_RP_TEMPLATE);
}
