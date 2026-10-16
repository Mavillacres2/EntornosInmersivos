import type { WorldTheme } from "./ScenarioPresentation";

/** Lightweight illustrations extend the existing SVG scene-card artwork. */
export function scenarioArtwork(theme: WorldTheme): string {
  const drawings: Record<WorldTheme, string> = {
    classroom: `<rect width="320" height="210" fill="#dcefe6"/>
      <path d="M0 156h320v54H0z" fill="#f1dfbd"/><path d="m0 156 160-15 160 15" fill="#c1dece"/>
      <rect x="74" y="26" width="174" height="106" rx="13" fill="#d9b276"/><rect x="82" y="34" width="158" height="90" rx="8" fill="#34786a"/>
      <path d="M103 57h40m-40 15h70m-70 15h30" stroke="#cee8d7" stroke-width="4" stroke-linecap="round"/>
      <circle cx="205" cy="75" r="18" fill="#f4d475"/><path d="m192 75 9 8 17-18" stroke="#34786a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="19" y="29" width="31" height="81" rx="14" fill="#f8fcf0"/><path d="M34 34v71m-11-36h23" stroke="#b2d8cb" stroke-width="3"/>
      <ellipse cx="110" cy="187" rx="63" ry="10" fill="#ccba9b" opacity=".45"/><ellipse cx="244" cy="177" rx="56" ry="8" fill="#ccba9b" opacity=".45"/>
      <path d="M63 150v34m84-34v34m57-45v34m70-34v34" stroke="#63877c" stroke-width="8" stroke-linecap="round"/>
      <rect x="41" y="129" width="128" height="25" rx="11" fill="#bd9163"/><rect x="41" y="123" width="128" height="22" rx="11" fill="#f4d9a5"/>
      <rect x="185" y="118" width="109" height="24" rx="10" fill="#bd9163"/><rect x="185" y="113" width="109" height="20" rx="10" fill="#f4d9a5"/>
      <rect x="59" y="163" width="70" height="22" rx="10" fill="#dc816a"/><rect x="210" y="152" width="54" height="18" rx="8" fill="#739fbd"/>
      <rect x="93" y="116" width="37" height="7" rx="3" fill="#fffdf4"/><rect x="96" y="109" width="34" height="7" rx="3" fill="#7caac4"/>
      <path d="m263 55 8-12 8 12-8 12Z" fill="#e9ab76"/>`,
    space: `<rect width="320" height="210" fill="#e4ebfa"/>
      <rect x="30" y="20" width="260" height="153" rx="51" fill="#94abc9"/><rect x="39" y="28" width="242" height="137" rx="45" fill="#253b61"/>
      <circle cx="164" cy="88" r="42" fill="#819bda"/><path d="M127 70q34 22 76 17m-77 18q34 16 69 12" fill="none" stroke="#abc1ef" stroke-width="9"/>
      <ellipse cx="164" cy="90" rx="67" ry="15" transform="rotate(-23 164 90)" stroke="#e7ca87" stroke-width="7" fill="none"/>
      <circle cx="239" cy="52" r="13" fill="#e5ae8e"/><circle cx="79" cy="123" r="9" fill="#a2d0ca"/>
      <path d="M76 52v10m-5-5h10m147 68v10m-5-5h10M110 35v7m-3-3h6" stroke="#f2f6ff" stroke-width="2" stroke-linecap="round"/>
      <path d="M0 171h320v39H0z" fill="#c5d4e9"/><ellipse cx="161" cy="193" rx="106" ry="10" fill="#8ba1c2" opacity=".35"/>
      <rect x="63" y="149" width="194" height="39" rx="16" fill="#597497"/><rect x="58" y="143" width="204" height="24" rx="11" fill="#d2e1ee"/>
      <rect x="83" y="127" width="57" height="29" rx="8" fill="#244365"/><path d="m94 145 9-7 10 5 15-11" stroke="#88d8cf" stroke-width="3" fill="none"/>
      <rect x="173" y="127" width="57" height="29" rx="8" fill="#244365"/><circle cx="190" cy="140" r="4" fill="#f2ce7e"/><path d="M202 137h18m-18 7h11" stroke="#b6d8ed" stroke-width="3" stroke-linecap="round"/>
      <rect x="127" y="173" width="67" height="25" rx="12" fill="#3e6090"/>`,
    museum: `<rect width="320" height="210" fill="#f0e8f6"/>
      <path d="M0 161h320v49H0z" fill="#e7d9cd"/><path d="M35 160V67a42 42 0 0 1 84 0v93" fill="#d8c6e4"/><path d="M45 159V69a32 32 0 0 1 64 0v90" fill="#f8f2e6"/>
      <path d="M198 160V67a42 42 0 0 1 84 0v93" fill="#d8c6e4"/><path d="M208 159V69a32 32 0 0 1 64 0v90" fill="#f8f2e6"/>
      <rect x="53" y="76" width="48" height="47" rx="9" fill="#b891b9"/><path d="m60 111 11-17 10 9 12-17" fill="none" stroke="#faeed6" stroke-width="4" stroke-linejoin="round"/>
      <rect x="218" y="76" width="45" height="47" rx="9" fill="#80b6b0"/><circle cx="240" cy="99" r="13" fill="#f6d58c"/>
      <ellipse cx="161" cy="188" rx="59" ry="10" fill="#bfacc7" opacity=".35"/><rect x="120" y="139" width="82" height="46" rx="14" fill="#826796"/><rect x="115" y="132" width="92" height="18" rx="9" fill="#f1d8ab"/>
      <circle cx="160" cy="95" r="21" fill="#e8bd6e"/><ellipse cx="160" cy="95" rx="45" ry="15" transform="rotate(-35 160 95)" fill="none" stroke="#7b9ab7" stroke-width="6"/>
      <ellipse cx="160" cy="95" rx="41" ry="15" transform="rotate(55 160 95)" fill="none" stroke="#b489b7" stroke-width="5"/>
      <rect x="27" y="172" width="64" height="17" rx="8" fill="#a5b7a0"/><path d="M37 189v9m44-9v9" stroke="#6e8870" stroke-width="5" stroke-linecap="round"/>
      <path d="m288 38 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#be99c1"/>`
  };
  return `<svg viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${drawings[theme]}</svg>`;
}
