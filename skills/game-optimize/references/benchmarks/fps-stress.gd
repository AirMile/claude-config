extends Node
## FPS stress benchmark: spawn N entities, sample FPS over warmup + measure window.
## Print "SCORE=<avg_fps>" en quit.
## Substitueer placeholders bij kopiëren: {ENTITY_COUNT}, {ENTITY_SCENE_PATH}.

const ENTITY_COUNT: int = {ENTITY_COUNT}
const ENTITY_SCENE_PATH: String = "{ENTITY_SCENE_PATH}"  # bv. "res://scenes/enemy.tscn"
const WARMUP_FRAMES: int = 120
const SAMPLE_FRAMES: int = 600

var _frame: int = 0
var _samples: Array[float] = []

func _ready() -> void:
	var scene: PackedScene = load(ENTITY_SCENE_PATH)
	if scene == null:
		print("SCORE=0")
		get_tree().quit(1)
		return
	for i in ENTITY_COUNT:
		var inst: Node = scene.instantiate()
		add_child(inst)
		# Spreid posities indien Node2D/Node3D
		if inst is Node2D:
			(inst as Node2D).position = Vector2(randi() % 1920, randi() % 1080)

func _process(_delta: float) -> void:
	_frame += 1
	if _frame > WARMUP_FRAMES and _frame <= WARMUP_FRAMES + SAMPLE_FRAMES:
		_samples.append(Engine.get_frames_per_second())
	elif _frame > WARMUP_FRAMES + SAMPLE_FRAMES:
		var sum := 0.0
		for f in _samples: sum += f
		var avg := sum / max(_samples.size(), 1)
		print("SCORE=%.2f" % avg)
		get_tree().quit()
