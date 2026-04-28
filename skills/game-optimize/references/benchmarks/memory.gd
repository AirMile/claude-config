extends Node
## Memory benchmark: peak static memory in MB tijdens N seconden simulatie.
## Print "SCORE=<peak_mb>" en quit. Lower is better.
## Substitueer: {DURATION_FRAMES}, {SCENE_TO_LOAD}.

const DURATION_FRAMES: int = {DURATION_FRAMES}
const SCENE_TO_LOAD: String = "{SCENE_TO_LOAD}"

var _frame: int = 0
var _peak: float = 0.0

func _ready() -> void:
	if SCENE_TO_LOAD != "":
		var scene: PackedScene = load(SCENE_TO_LOAD)
		if scene != null:
			add_child(scene.instantiate())

func _process(_delta: float) -> void:
	_frame += 1
	var mem_bytes := Performance.get_monitor(Performance.MEMORY_STATIC)
	var mem_mb := mem_bytes / 1024.0 / 1024.0
	if mem_mb > _peak:
		_peak = mem_mb
	if _frame >= DURATION_FRAMES:
		print("SCORE=%.2f" % _peak)
		get_tree().quit()
