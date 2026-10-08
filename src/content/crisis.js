/**
 * Crisis lines and domestic abuse services by country, for crisis_support and
 * for the safety block every other tool puts first when it is needed. `lines`
 * are suicide and crisis lines; `abuse` are domestic abuse services, shown first
 * when the concern is abuse.
 *
 * Each line was checked on the service's own website on CHECKED (the `url` is the
 * page to re-check). Numbers, hours and channels change with little notice, so
 * the date is printed with every answer and the README says how to re-verify.
 * Where a service could not be confirmed on an official page it is left out; the
 * global directory below covers every country this table does not.
 *
 * Some numbers collide across countries (113 is the Dutch suicide line and
 * Norway's medical emergency number; 116 123 is Samaritans in the UK and Ireland,
 * TelefonSeelsorge in Germany and Mental Helse in Norway), which is why a number
 * is never shown without its country.
 */

export const CHECKED = "2026-10-07";

export const DIRECTORIES = [
  { name: "Find A Helpline", url: "https://findahelpline.com/", note: "free, verified helplines in 175+ countries, searchable by country and topic" },
  { name: "Befrienders Worldwide", url: "https://befrienders.org/find-support-now/", note: "emotional support centres worldwide" },
];

/** What to do instead of a helpline: the immediate-danger rule. */
export const EMERGENCY_RULE =
  "If someone has already hurt themselves, has taken something, has the means in hand and intends to use it, or " +
  "cannot keep themselves safe right now, call the local emergency number or go to the nearest emergency department. " +
  "Helplines are for talking it through when there is no immediate physical danger.";

export const COUNTRIES = [
  {
    code: "NL", name: "Netherlands", emergency: "112",
    abuse: [{ name: "Veilig Thuis (domestic abuse and child abuse, all genders)", phone: "0800-2000 (free)", chat: "https://veiligthuis.nl/", hours: "24/7", url: "https://veiligthuis.nl/" }],
    lines: [
      { name: "113 Zelfmoordpreventie", phone: "113 or 0800-0113 (both free)", chat: "https://www.113.nl/chat", hours: "24/7", url: "https://www.113.nl/" },
      { name: "113 advice line for people worried about someone else", phone: "020-311 3888", hours: "working days 10:00-16:00", url: "https://www.113.nl/", forOthers: true },
    ],
  },
  {
    code: "ZA", name: "South Africa", emergency: "10111 (police), 10177 (ambulance), 112 from a mobile",
    abuse: [{ name: "GBV Command Centre", phone: "0800 428 428 (free)", text: "SMS HELP to 31531", hours: "24 hours", url: "https://gbv.org.za/" }],
    lines: [
      { name: "SADAG Suicide Crisis Helpline", phone: "0800 567 567 (toll-free)", hours: "24 hours", url: "https://www.sadag.org/" },
      { name: "SADAG / Cipla Mental Health Helpline", phone: "0800 456 789 (toll-free)", text: "SMS 31393; WhatsApp 076 882 2775 (8am-5pm)", hours: "phone and SMS 24 hours", url: "https://www.sadag.org/" },
    ],
  },
  {
    code: "GB", name: "United Kingdom", emergency: "999 or 112",
    abuse: [
      { name: "National Domestic Abuse Helpline (England, run by Refuge)", phone: "0808 2000 247 (free)", chat: "https://www.nationaldahelpline.org.uk/", hours: "24/7", url: "https://www.nationaldahelpline.org.uk/" },
      { name: "Men's Advice Line (Respect)", phone: "0808 801 0327 (free)", hours: "weekdays 10am-5pm", url: "https://mensadviceline.org.uk/" },
      { name: "Scotland's Domestic Abuse and Forced Marriage Helpline", phone: "0800 027 1234", hours: "24/7", url: "https://sdafmh.org.uk/" },
      { name: "Live Fear Free (Wales)", phone: "0808 80 10 800", text: "text 07860 077333", hours: "24/7", url: "https://www.gov.wales/live-fear-free" },
      { name: "Domestic and Sexual Abuse Helpline (Northern Ireland)", phone: "0808 802 1414", hours: "24/7", url: "https://www.dsahelpline.org/" },
    ],
    lines: [
      { name: "Samaritans", phone: "116 123 (free); Welsh language 0808 164 0123", hours: "24/7", url: "https://www.samaritans.org/" },
      { name: "Shout", text: "text SHOUT to 85258", hours: "24/7", url: "https://giveusashout.org/" },
    ],
  },
  {
    code: "IE", name: "Ireland", emergency: "112 or 999",
    abuse: [
      { name: "Women's Aid", phone: "1800 341 900 (freephone)", hours: "24/7", url: "https://www.womensaid.ie/" },
      { name: "Men's Aid", phone: "01 554 3811", hours: "weekdays 9am-5pm", url: "https://www.mensaid.ie/" },
    ],
    lines: [
      { name: "Samaritans Ireland", phone: "116 123 (freephone)", hours: "24/7", url: "https://www.samaritans.org/ireland/samaritans-ireland/" },
      { name: "50808", text: "text HELLO to 50808 (free)", hours: "24/7", url: "https://text50808.ie/" },
      { name: "Pieta", phone: "1800 247 247", text: "text HELP to 51444 (standard rates)", hours: "24/7", url: "https://www.pieta.ie/" },
    ],
  },
  {
    code: "US", name: "United States", emergency: "911",
    abuse: [{ name: "National Domestic Violence Hotline", phone: "1-800-799-7233", text: "text START to 88788", chat: "https://www.thehotline.org/", hours: "24/7", url: "https://www.thehotline.org/" }],
    lines: [
      { name: "988 Suicide & Crisis Lifeline", phone: "988", text: "text 988", chat: "https://chat.988lifeline.org/", hours: "24/7", url: "https://988lifeline.org/" },
    ],
  },
  {
    code: "CA", name: "Canada", emergency: "911",
    abuse: [{ name: "No national line: provincial lines and shelters (canada.ca lists them; sheltersafe.ca maps the nearest shelter)", phone: "for example Ontario 1-866-863-0511, Quebec 1-800-363-9010, BC 1-800-563-0808", url: "https://www.canada.ca/en/public-health/services/health-promotion/stop-family-violence/services.html" }],
    lines: [{ name: "9-8-8 Suicide Crisis Helpline", phone: "988", text: "text 988", hours: "24/7", url: "https://988.ca/" }],
  },
  {
    code: "AU", name: "Australia", emergency: "000",
    abuse: [{ name: "1800RESPECT", phone: "1800 737 732 (free)", chat: "https://www.1800respect.org.au/", hours: "24/7", url: "https://www.1800respect.org.au/" }],
    lines: [
      { name: "Lifeline Australia", phone: "13 11 14", text: "0477 13 11 14", chat: "https://www.lifeline.org.au/crisis-chat/", hours: "24/7", url: "https://www.lifeline.org.au/" },
    ],
  },
  {
    code: "NZ", name: "New Zealand", emergency: "111",
    abuse: [
      { name: "Are You OK (all genders)", phone: "0800 456 450 (free)", chat: "https://areyouok.org.nz/", hours: "24/7", url: "https://areyouok.org.nz/" },
      { name: "Women's Refuge Crisisline", phone: "0800 733 843 (free)", hours: "24 hours", url: "https://www.womensrefuge.org.nz/" },
    ],
    lines: [
      { name: "1737 Need to Talk?", phone: "1737 (free)", text: "text 1737 (free)", hours: "24/7", url: "https://1737.org.nz/" },
      { name: "Lifeline Aotearoa", phone: "0800 543 354; Suicide Crisis Helpline 0508 828 865", text: "text 4357", hours: "7am to midnight (use 1737 overnight)", url: "https://www.lifeline.org.nz/" },
    ],
  },
  {
    code: "DE", name: "Germany", emergency: "112",
    abuse: [
      { name: "Hilfetelefon Gewalt gegen Frauen", phone: "116 016 (free)", chat: "https://www.hilfetelefon.de/", hours: "24/7", url: "https://www.hilfetelefon.de/" },
      { name: "Hilfetelefon Gewalt an Männern", phone: "0800 1239900 (free)", hours: "Mon-Thu 8am-8pm, Fri 8am-3pm", url: "https://www.maennerhilfetelefon.de/" },
    ],
    lines: [
      { name: "TelefonSeelsorge", phone: "0800 111 0 111, 0800 111 0 222 or 116 123 (free)", chat: "https://www.telefonseelsorge.de/chat/", hours: "phone 24/7", url: "https://www.telefonseelsorge.de/" },
    ],
  },
  {
    code: "BE", name: "Belgium", emergency: "112",
    abuse: [
      { name: "1712 (Dutch)", phone: "1712 (free)", chat: "https://www.1712.be/", hours: "weekdays 9am-6pm", url: "https://www.1712.be/" },
      { name: "Écoute violences conjugales (French)", phone: "0800 30 030 (free)", url: "https://www.ecouteviolencesconjugales.be/" },
    ],
    lines: [
      { name: "Zelfmoordlijn 1813 (Dutch)", phone: "1813", chat: "https://www.zelfmoord1813.be/", hours: "phone 24/7; chat evenings", url: "https://www.zelfmoord1813.be/" },
      { name: "Centre de Prévention du Suicide (French)", phone: "0800 32 123 (free)", hours: "24/7", url: "https://www.preventionsuicide.be/" },
    ],
  },
  {
    code: "FR", name: "France", emergency: "112 (15 for medical)",
    abuse: [{ name: "3919 Violences Femmes Info", phone: "3919 (free)", hours: "24/7", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F12544" }],
    lines: [{ name: "3114, numéro national de prévention du suicide", phone: "3114 (free)", hours: "24/7", url: "https://3114.fr/" }],
  },
  {
    code: "ES", name: "Spain", emergency: "112",
    abuse: [{ name: "016", phone: "016 (free, leaves no trace on the bill)", hours: "24 hours", url: "https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/igualdad/Paginas/2026/telefono-016-que-es.aspx" }],
    lines: [{ name: "Línea 024", phone: "024 (free)", hours: "24/7", url: "https://www.sanidad.gob.es/linea024/home.htm" }],
  },
  {
    code: "IT", name: "Italy", emergency: "112",
    abuse: [{ name: "1522 antiviolenza e stalking", phone: "1522 (free)", chat: "https://www.1522.eu/", hours: "24/7", url: "https://www.1522.eu/" }],
    lines: [{ name: "Telefono Amico Italia", phone: "02 2327 2327", text: "WhatsApp 324 011 72 52", hours: "every day", url: "https://www.telefonoamico.it/" }],
  },
  {
    code: "PT", name: "Portugal", emergency: "112",
    abuse: [{ name: "SIVVD, domestic violence information line", phone: "800 202 148 (free)", text: "SMS 3060", hours: "24 hours", url: "https://www.cig.gov.pt/servicos-de-apoio/servico-de-informacao-as-vitimas-de-violencia-domestica/" }],
    lines: [
      { name: "SNS 24, psychological support", phone: "808 24 24 24, option 4", hours: "24/7", url: "https://www.sns24.gov.pt/servico/aconselhamento-psicologico-no-sns-24/" },
      { name: "SOS Voz Amiga", phone: "213 544 545", hours: "daily 15:30-00:30", url: "https://www.sosvozamiga.org/" },
    ],
  },
  {
    code: "SE", name: "Sweden", emergency: "112",
    abuse: [{ name: "Kvinnofridslinjen (all genders)", phone: "116 016 (free)", hours: "24/7", url: "https://kvinnofridslinjen.se/" }],
    lines: [{ name: "Självmordslinjen (Mind)", phone: "90101", chat: "https://mind.se/", hours: "24/7", url: "https://mind.se/" }],
  },
  {
    code: "NO", name: "Norway", emergency: "113 (medical), 112 (police)",
    abuse: [{ name: "VO-linjen (all genders)", phone: "116 006 (free)", hours: "24/7", url: "https://www.volinjen.no/" }],
    lines: [{ name: "Mental Helse Hjelpetelefonen", phone: "116 123", chat: "https://mentalhelse.no/", hours: "24/7", url: "https://mentalhelse.no/" }],
  },
  {
    code: "DK", name: "Denmark", emergency: "112",
    abuse: [{ name: "Lev Uden Vold (all genders)", phone: "1888 (free)", hours: "24/7", url: "https://www.levudenvold.dk/" }],
    lines: [{ name: "Livslinien", phone: "70 201 201", chat: "https://www.livslinien.dk/", hours: "phone daily 09:00-05:00", url: "https://www.livslinien.dk/" }],
  },
  {
    code: "FI", name: "Finland", emergency: "112",
    abuse: [{ name: "Nollalinja (all genders)", phone: "116 016 (free)", hours: "24/7", url: "https://www.nollalinja.fi/en/" }],
    lines: [{ name: "MIELI Crisis Helpline", phone: "09 2525 0111", hours: "24/7 (Finnish)", url: "https://mieli.fi/" }],
  },
  {
    code: "CH", name: "Switzerland", emergency: "144 (ambulance), 117 (police), 112",
    abuse: [{ name: "Opferhilfe 142 (victim support)", phone: "142 (free)", hours: "24/7", url: "https://www.opferhilfe-schweiz.ch/de/" }],
    lines: [{ name: "Die Dargebotene Hand / La Main Tendue (Tel 143)", phone: "143", chat: "https://www.143.ch/", hours: "24/7", url: "https://www.143.ch/" }],
  },
  {
    code: "AT", name: "Austria", emergency: "144 (ambulance), 133 (police), 112",
    abuse: [{ name: "Frauenhelpline gegen Gewalt", phone: "0800 222 555 (free)", hours: "24/7", url: "https://www.frauenhelpline.at/" }],
    lines: [{ name: "TelefonSeelsorge Österreich", phone: "142 (free)", chat: "https://www.telefonseelsorge.at/", hours: "phone 24/7; chat 16:00-23:00", url: "https://www.telefonseelsorge.at/" }],
  },
  {
    code: "IN", name: "India", emergency: "112",
    abuse: [{ name: "Women Helpline 181", phone: "181 (toll-free)", hours: "24 hours", url: "https://wcd.gov.in/women/help" }],
    lines: [{ name: "Tele-MANAS", phone: "14416 or 1800-89-14416 (toll-free)", hours: "24/7, about 20 languages", url: "https://telemanas.mohfw.gov.in/" }],
  },
  {
    code: "SG", name: "Singapore", emergency: "995 (ambulance), 999 (police)",
    abuse: [{ name: "National Anti-Violence and Sexual Harassment Helpline (a reporting line; police may be involved)", phone: "1800-777-0000", hours: "24 hours", url: "https://www.msf.gov.sg/what-we-do/break-the-silence/get-help/i-want-to-report-domestic-violence" }],
    lines: [{ name: "Samaritans of Singapore", phone: "1767", text: "WhatsApp 9151 1767", hours: "24/7", url: "https://www.sos.org.sg/" }],
  },
  {
    code: "JP", name: "Japan", emergency: "119 (ambulance), 110 (police)",
    abuse: [{ name: "DV相談＋ (DV Soudan Plus)", phone: "0120-279-889", chat: "https://soudanplus.jp/", hours: "24 hours", url: "https://soudanplus.jp/" }],
    lines: [
      { name: "#いのちSOS (Inochi SOS)", phone: "0120-061-338 (free)", hours: "24/7", url: "https://www.mhlw.go.jp/mamorouyokokoro/" },
      { name: "よりそいホットライン (Yorisoi Hotline)", phone: "0120-279-338 (free)", hours: "24/7", url: "https://www.mhlw.go.jp/mamorouyokokoro/" },
    ],
  },
  {
    code: "BR", name: "Brazil", emergency: "192 (ambulance), 190 (police)",
    abuse: [{ name: "Ligue 180", phone: "180 (free)", text: "WhatsApp (61) 9610-0180", hours: "24/7", url: "https://www.gov.br/mulheres/pt-br/ligue180" }],
    lines: [{ name: "CVV, Centro de Valorização da Vida", phone: "188 (free)", chat: "https://cvv.org.br/", hours: "phone 24/7", url: "https://cvv.org.br/" }],
  },
  {
    code: "MX", name: "Mexico", emergency: "911",
    abuse: [{ name: "Línea de las Mujeres", phone: "079, option 1 (free)", hours: "24 hours", url: "https://www.gob.mx/mujeres/prensa/linea-de-las-mujeres-079-opcion-1-ofrece-atencion-integral-para-las-mujeres-citlalli-hernandez?idiom=es" }],
    lines: [{ name: "Línea de la Vida", phone: "800 911 2000 (free)", hours: "24/7", url: "https://www.gob.mx/lineadelavida" }],
  },
];

/** Country names and common spellings people type, mapped to codes. */
export const COUNTRY_ALIASES = {
  "netherlands": "NL", "holland": "NL", "nederland": "NL", "the netherlands": "NL",
  "south africa": "ZA", "rsa": "ZA",
  "uk": "GB", "united kingdom": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB", "britain": "GB", "great britain": "GB",
  "ireland": "IE", "eire": "IE",
  "usa": "US", "united states": "US", "america": "US", "us": "US",
  "canada": "CA", "australia": "AU", "new zealand": "NZ", "aotearoa": "NZ",
  "germany": "DE", "deutschland": "DE", "belgium": "BE", "belgie": "BE", "belgique": "BE",
  "france": "FR", "spain": "ES", "españa": "ES", "espana": "ES", "italy": "IT", "italia": "IT", "portugal": "PT",
  "sweden": "SE", "sverige": "SE", "norway": "NO", "norge": "NO", "denmark": "DK", "danmark": "DK",
  "finland": "FI", "suomi": "FI", "switzerland": "CH", "schweiz": "CH", "suisse": "CH",
  "austria": "AT", "österreich": "AT", "osterreich": "AT", "india": "IN", "singapore": "SG",
  "japan": "JP", "brazil": "BR", "brasil": "BR", "mexico": "MX", "méxico": "MX",
};
