# WHATWG HTML named character reference data

Original parser code is under the MIT license in `LICENSE`. This does not
relicense third-party data. Additional development-only fixtures in
`corpus/release-015/` are from libass (ISC; local `libass/COPYING`) and Microsoft
Windows-classic-samples (MIT; local `microsoft/LICENSE`), with exact revisions,
URLs and hashes in that directory's manifest. These fixtures are not in the
npm tarball. The external sample/writer provenance and coverage limits are
documented in `docs/RELEASE.md`.

Development-only `corpus/corpus-016/` adds unchanged authored samples from
Arnavion/libjass (Apache-2.0), subtitle-rs/subtitler (Apache-2.0), and
SubtitleEdit/subtitleedit (MIT). Each upstream license is retained alongside
its samples; `manifest.json` pins revisions, original URLs and SHA-256 hashes.
No upstream parser implementation, font or image is incorporated. These samples
and licenses are excluded from the npm tarball. Additional downloaded originals
with uncertain transcript redistribution rights remain in ignored local caches;
their metadata alone is in `research/corpus-016/local-manifest.json`.

Development-only corpus: WPT files retain their BSD-3-Clause notice in
`corpus/wpt/LICENSE.md`. *Tears of Steel* subtitles are attributed to
**(CC) Blender Foundation | mango.blender.org** and volunteer translators under
CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), with unchanged original
files and provenance documented in `docs/CORPUS.md`. Corpus and comparison
dependencies are not shipped in the npm tarball. No third-party parser code is
incorporated into the runtime. The small windows-1252 mapping in `decode.ts` is
standard character data from https://encoding.spec.whatwg.org/index-windows-1252.txt
under WHATWG's BSD terms reproduced below.

`entities.reference.json` was retrieved on 2026-10-23 from
https://html.spec.whatwg.org/entities.json . `src/entities.ts` is a mechanical
projection of the names and Unicode values. No parser code
was copied. `scripts/generate-entities.mjs` reproduces that projection.

Copyright © WHATWG (Apple, Google, Mozilla, Microsoft).
The HTML standard portions incorporated into source code use the BSD 3-Clause
License, per https://whatwg.org/ipr-policy#copyright-license-for-whatwg-publications .

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
