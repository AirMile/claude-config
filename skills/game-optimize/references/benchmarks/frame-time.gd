extends Node
## Frame time benchmark: meet gemiddelde ms per frame.
## Print "SCORE=<avg_ms>" en quit. Lower is better.
## Substitueer: {DURATION_FRAMES}, {SCENE_TO_LOAD}.

const DURATION_FRAMES: int = {DURATION_FRAMES}  # bv. 600 (10s @ 60fps)
const SCENE_TO_LOAD: String = "{SCENE_TO_LOAD}"  # bv. "res://scenes/level_1.tscn"
const WARMUP_FRAMES: int = 120

var _frame: int = 0
var _samples: Array[float] = []

func _ready() -> void:
	if SCENE_TO_LOAD != "":
		var scene: PackedScene = load(SCENE_TO_LOAD)
		if scene != null:
			add_child(scene.instantiate())

func _process(delta: float) -> void:
	_frame += 1
	if _frame > WARMUP_FRAMES and _frame <= WARMUP_FRAMES + DURATION_FRAMES:
		_samples.append(delta * 1000.0)
	elif _frame > WARMUP_FRAMES + DURATION_FRAMES:
		var sum := 0.0
		for s in _samples: sum += s
		var avg := sum / max(_samples.size(), 1)
		print("SCORE=%.3f" % avg)
		get_tree().quit()
