[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/bsnpg/duskfall/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/bsnpg/duskfall/reward.svg)](https://make.fun/bounty/best-game-01)

# Duskfall — Altar of the Last Light

A complete 2D action RPG that runs in a desktop browser from static files.
No build step, no network requests, no libraries — just canvas, vanilla
JavaScript and procedural WebAudio sound.

## The story

Darkness has come. Four people are chosen and given extraordinary talents —
but no one may choose their talent. Your power is drawn at random when you
begin, and so are your stats. What makes you strong is the **equipment**
and **armor** you take from monsters.

## The loop

- **Random talent.** Start the game and fate rolls your class: Archer
  (accuracy + speed), Knight (endurance + strength), Mage (area magic) or
  Support (heal + buff). You cannot pick. Your stats are random too.
- **Crystals are fuel.** Every attack and skill burns your job's crystal:
  Speed for the Archer, Str for the Knight, Magic for the Mage, Life for
  Support. With zero crystals you cannot fight at all.
- **Stones feed the altar.** Monsters drop stones of random kinds. Feed
  your job's stones to the Altar of the Last Light and it makes crystals.
  Stones of another job cannot be used — trade them with Bram the merchant.
- **Gear has a job.** Every armor piece belongs to one job: only that job
  can wear it. Gear of another job breaks down into random stones —
  1 for Common, 2 for Rare, 3 for Epic, 5 for Legendary.
- **The mine is safe, but timed.** The crystal mine holds only stones for
  the altar, never crystals directly. Entry is limited to 1 hour a day.
- **The dungeon has 20 floors.** Clear a floor to open the stairs down.
  Mini-bosses wait every 5 floors. You may always retreat to town to
  refuel — running dry on floor 20 with no way out is how heroes die.
  Every level-up offers a choice of 3 blessings — pick one, it lasts the run.
- **The ending.** Defeat the Demon King of Darkness on floor 20, take the
  Last Stone back to the altar, and light it perfectly so the darkness is
  erased from the earth. The goal is printed on the screen while you play,
  and the Demon King gets his own health bar on floor 20.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse + hold click | Attack toward the mouse (1 crystal) |
| Q | Class skill (3 crystals) |
| E | Use altar / trader / mine / doors / stairs |
| I | Bag & equipment (click own-job gear to equip, wrong-job gear to salvage) |
| M | Mute |
| R | Restart after death or victory |

## How to play

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

Or serve `game/` with any static file server and open `index.html`.

## Layout

- `game/index.html` — page, HUD and screens
- `game/src/main.js` — state machine, loop, town systems, ending
- `game/src/data.js` — classes, crystals, monsters, armor tables
- `game/src/world.js` — town, dungeon floors and mine builders
- `game/src/combat.js` — attacks, skills, monster AI, drops, XP, gear
- `game/src/render.js` — canvas drawing, dusk palette, dungeon darkness
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — procedural WebAudio effects and music
- `main.ts` — hands the game in: copies `game/` + `screenshots/` and
  writes `dossier.json` with the vendored make.fun library
- `screenshots/` — real renders of the game's own code

## License

MIT. See [LICENSE](LICENSE).
