# Attribution

The crates in this directory are vendored from
[Phono](https://github.com/jonathancaudill/phono) by Jonathan Caudill
(MIT licence, per each crate's Cargo.toml), which in turn patches
[librespot](https://github.com/librespot-org/librespot) 0.8.0 (MIT).

- `spotify-core/` - UniFFI engine: session, player, queue, AudioTrack sink.
- `librespot-*-patched/` - librespot forks; see each crate's PATCHES.md.

librespot crates are pinned to =0.8.0. Do not bump without re-validating
every patch (see the PATCHES.md files).
