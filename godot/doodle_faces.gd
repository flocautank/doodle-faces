## Doodle Faces — Godot 4 atlas loader.
##
## Loads a face atlas baked by the web tool ("Atlas + manifeste") and hands out
## an AtlasTexture for any id you already have: a character id, a name, a run
## seed. The mapping is stable — the same id always gets the same face, in this
## build and in the next one — because it uses the same FNV-1a hash as the
## JavaScript generator.
##
## Setup
##   1. In the web tool, pick a population and press "Atlas + manifeste".
##   2. Drop faces-<seed>.png and faces-<seed>.json into res://assets/faces/.
##   3. Register this script as an autoload named DoodleFaces
##      (Project > Project Settings > Globals), or instance it yourself.
##
## Usage
##   var tex := DoodleFaces.texture_for("dealer_3")
##   $Portrait.texture = tex
##
##   # or index straight into the pool
##   var tex2 := DoodleFaces.texture_at(17)
##
## Notes
##   * Bake the atlas with a light ink colour if your background is dark —
##     the exporter takes an `ink` override for exactly that.
##   * The atlas is transparent, so it composites over anything.

## An autoload has to be a Node, hence `extends Node` rather than RefCounted.
class_name DoodleFacesLoader
extends Node

const DEFAULT_PNG := "res://assets/faces/faces-hoh2.png"
const DEFAULT_JSON := "res://assets/faces/faces-hoh2.json"

var _texture: Texture2D
var _cells: Array[Rect2] = []
var _by_seed: Dictionary = {}
var _cache: Dictionary = {}

func _ready() -> void:
	# Convenient as an autoload: pick up the default atlas if it is there, and
	# stay quiet if it isn't (you may be loading a different one by hand).
	if ResourceLoader.exists(DEFAULT_PNG):
		load_atlas()

## Load an atlas. Returns true on success; logs and returns false otherwise.
func load_atlas(png_path: String = DEFAULT_PNG, json_path: String = DEFAULT_JSON) -> bool:
	_texture = null
	_cells.clear()
	_by_seed.clear()
	_cache.clear()

	if not ResourceLoader.exists(png_path):
		push_error("DoodleFaces: atlas image not found at %s" % png_path)
		return false
	_texture = load(png_path)

	var text := FileAccess.get_file_as_string(json_path)
	if text.is_empty():
		push_error("DoodleFaces: manifest not found or empty at %s" % json_path)
		return false

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("faces"):
		push_error("DoodleFaces: %s is not a doodle-faces manifest" % json_path)
		return false

	for entry: Variant in parsed["faces"]:
		var rect := Rect2(
			float(entry.get("x", 0)),
			float(entry.get("y", 0)),
			float(entry.get("w", 0)),
			float(entry.get("h", 0)),
		)
		_by_seed[String(entry.get("seed", ""))] = _cells.size()
		_cells.append(rect)

	return not _cells.is_empty()

## How many faces the atlas holds.
func count() -> int:
	return _cells.size()

## Whether an atlas has been loaded successfully.
func is_ready() -> bool:
	return _texture != null and not _cells.is_empty()

## A face for an arbitrary id — hashed into the pool.
func texture_for(id: String) -> AtlasTexture:
	if not is_ready():
		return null
	return texture_at(hash_seed(id) % count())

## A face by its exact seed, as recorded in the manifest ("hoh2#12").
## Falls back to hashing the string if that seed isn't in this atlas.
func texture_for_seed(seed_name: String) -> AtlasTexture:
	if not is_ready():
		return null
	if _by_seed.has(seed_name):
		return texture_at(int(_by_seed[seed_name]))
	return texture_for(seed_name)

## A face by pool index. Wraps, so any integer is valid.
func texture_at(index: int) -> AtlasTexture:
	if not is_ready():
		return null
	var i := posmod(index, count())
	if _cache.has(i):
		return _cache[i]
	var tex := AtlasTexture.new()
	tex.atlas = _texture
	tex.region = _cells[i]
	# filter_clip keeps neighbouring cells from bleeding in when scaled
	tex.filter_clip = true
	_cache[i] = tex
	return tex

## FNV-1a over the UTF-16 code units of `text`, matching hashSeed() in
## src/faces/rng.js. Keep the two in step if you ever change one.
static func hash_seed(text: String) -> int:
	var h := 0x811c9dc5
	for i in text.length():
		h ^= text.unicode_at(i)
		h = _imul32(h, 0x01000193)
	return h if h != 0 else 0x9e3779b9

## 32-bit multiply with wraparound, bit-identical to JavaScript's Math.imul.
## Done in 16-bit halves so the intermediate product can't overflow int64.
static func _imul32(a: int, b: int) -> int:
	var al := a & 0xFFFF
	var ah := (a >> 16) & 0xFFFF
	var bl := b & 0xFFFF
	var bh := (b >> 16) & 0xFFFF
	return (al * bl + (((al * bh + ah * bl) & 0xFFFF) << 16)) & 0xFFFFFFFF
