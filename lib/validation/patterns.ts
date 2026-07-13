/**
 * Kliensoldali regex minták — a Worf FastAPI backend (REGEX_PATTERNS.md) mintáinak
 * Unicode-helyes JS megfelelői. A cél, hogy a frontend 1:1 azt fogadja el, amit a backend.
 *
 * FONTOS Unicode-megjegyzések (a backend-audit alapján):
 * - A backend Python `\w`/`\d` str-módban Unicode-tudatos. JS-ben `\w`/`\d` mindig ASCII,
 *   ezért ahol a backend `\w`-t használ, itt `\p{L}\p{N}_` osztályt használunk `u` flaggel,
 *   a `\d` helyett pedig explicit `[0-9]`-et.
 * - A jelszó szimbólum-szabály a backendben `[^\w\s]` (Unicode `\w`), ezért ékezetes betű
 *   NEM szimbólum. JS-ben ezt `[^A-Za-z0-9_\s]`-ként kell írni — de mivel az ékezetes betűt
 *   a backend betűnek veszi, a szimbólum-ellenőrzésnek is ki kell zárnia a Unicode betűket
 *   (lásd password.ts, ahol ezt kezeljük), nem elég a naiv ASCII-osztály.
 */

/**
 * E-mail formátum — a backend `^[\w\.-]+@[\w\.-]+\.\w+$` mintája.
 * Unicode local-part elfogadva (pl. `felhasználó@x.hu`), mert a backend `\w` Unicode.
 */
export const EMAIL_PATTERN = /^[\p{L}\p{N}_.-]+@[\p{L}\p{N}_.-]+\.[\p{L}\p{N}_]+$/u;

/**
 * Teljes (magyar) név — a backend fullnamecheck.py mintájának 1:1 portja.
 * Minden névelem nagybetűvel kezdődik; kötőjeles (dupla) vezetéknév megengedett;
 * a záró `+` miatt LEGALÁBB két névelem (vezeték- + keresztnév) kötelező.
 */
export const FULL_NAME_PATTERN =
  /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:-[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)*(?:\s[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:-[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)*)+$/;

/** Jelszó karakterosztály-szabályok (passwordpolicy.py). */
export const PASSWORD_LOWERCASE = /[a-z]/;
export const PASSWORD_UPPERCASE = /[A-Z]/;
/** Szám: explicit ASCII `[0-9]`, NEM `\d` (a backend `\d` Unicode, de itt ASCII a biztos egyezés). */
export const PASSWORD_DIGIT = /[0-9]/;
/**
 * Szimbólum: a backend `[^\w\s]` (Unicode `\w`) — azaz nem-betű, nem-szám, nem-`_`, nem-whitespace.
 * JS-ben Unicode-helyesen: minden ami NEM Unicode betű/szám, NEM `_`, és NEM whitespace.
 * (Naiv `[^A-Za-z0-9_\s]` ékezetes betűt tévesen szimbólumnak venné — ezt itt `u` flaggel
 *  és Unicode property-vel kerüljük el, hogy 1:1 egyezzen a backenddel.)
 */
export const PASSWORD_SYMBOL = /[^\p{L}\p{N}_\s]/u;

/** Jelszó minimum hossz (a backend-dokumentum nem adja meg; a meglévő ProfileForm 8-at használ). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Fájlnév — a backend `^[a-zA-Z0-9._\-\s()]+$` mintája (files.py).
 * A path-traversal ellenőrzés NEM a regex része — külön a FILENAME_TRAVERSAL_TOKENS-szel.
 */
export const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._\-\s()]+$/;

/** Path-traversal / könyvtár-elválasztó tokenek, amiket a fájlnév nem tartalmazhat. */
export const FILENAME_TRAVERSAL_TOKENS = ['..', '/', '\\'] as const;

/**
 * Vezérlőkarakterek (guardrail mezőkhöz) — nyomtathatatlan ASCII karakterek, DE a
 * legitim whitespace (tab `\x09`, újsor `\x0A`, kocsivissza `\x0D`) KIVÉTELÉVEL, hogy a
 * többsoros mezők (komment, leírás, poszt-törzs) sortörései ne minősüljenek érvénytelennek.
 */
export const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
