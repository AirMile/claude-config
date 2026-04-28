extends Node
## AI win-rate benchmark: simuleer N matches, print percentage wins.
## Print "SCORE=<winrate_pct>" en quit. Higher is better.
## Substitueer: {MATCH_COUNT}, {AI_RUNNER_SCRIPT_PATH}.
##
## Vereist: een script op AI_RUNNER_SCRIPT_PATH dat een functie heeft:
##   func run_match(seed: int) -> bool   # true = AI wint
## Zo niet aanwezig: maak deze in je project of pas dit benchmark aan.

const MATCH_COUNT: int = {MATCH_COUNT}
const AI_RUNNER_SCRIPT_PATH: String = "{AI_RUNNER_SCRIPT_PATH}"
const FIXED_SEED_BASE: int = 42  # determinisme — verander niet per run

func _ready() -> void:
	var runner_script: Script = load(AI_RUNNER_SCRIPT_PATH)
	if runner_script == null:
		print("SCORE=0")
		get_tree().quit(1)
		return
	var runner: Object = runner_script.new()
	if not runner.has_method("run_match"):
		print("SCORE=0")
		get_tree().quit(1)
		return

	var wins := 0
	for i in MATCH_COUNT:
		seed(FIXED_SEED_BASE + i)
		if runner.run_match(FIXED_SEED_BASE + i):
			wins += 1

	var pct := (float(wins) / float(MATCH_COUNT)) * 100.0
	print("SCORE=%.2f" % pct)
	get_tree().quit()
