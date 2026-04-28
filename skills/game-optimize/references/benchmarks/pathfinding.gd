extends Node
## Pathfinding benchmark: bereken N paths, print totaal in ms.
## Print "SCORE=<total_ms>" en quit. Lower is better.
## Substitueer: {PATH_COUNT}, {MAP_SCENE_PATH}, {NAVIGATION_NODE_PATH}.

const PATH_COUNT: int = {PATH_COUNT}
const MAP_SCENE_PATH: String = "{MAP_SCENE_PATH}"
const NAVIGATION_NODE_PATH: NodePath = "{NAVIGATION_NODE_PATH}"
const FIXED_SEED: int = 42

func _ready() -> void:
	var map_scene: PackedScene = load(MAP_SCENE_PATH)
	if map_scene == null:
		print("SCORE=999999")
		get_tree().quit(1)
		return
	var map := map_scene.instantiate()
	add_child(map)
	# Geef Godot een frame om navigation mesh op te bouwen
	await get_tree().process_frame
	await get_tree().process_frame

	var nav_node := map.get_node_or_null(NAVIGATION_NODE_PATH)
	if nav_node == null:
		print("SCORE=999999")
		get_tree().quit(1)
		return

	# Verzamel willekeurige start/end punten binnen een aanname-range.
	# Pas aan op je map-coördinaten.
	seed(FIXED_SEED)
	var start_t := Time.get_ticks_usec()
	for i in PATH_COUNT:
		var from := Vector3(randf_range(-50, 50), 0, randf_range(-50, 50))
		var to := Vector3(randf_range(-50, 50), 0, randf_range(-50, 50))
		# Werkt voor NavigationRegion3D / NavigationServer3D path
		if nav_node.has_method("get_navigation_path"):
			nav_node.get_navigation_path(from, to)
		else:
			NavigationServer3D.map_get_path(nav_node.get_navigation_map(), from, to, true)
	var elapsed_ms := (Time.get_ticks_usec() - start_t) / 1000.0
	print("SCORE=%.2f" % elapsed_ms)
	get_tree().quit()
