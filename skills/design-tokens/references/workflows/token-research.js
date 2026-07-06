export const meta = {
  name: 'token-research',
  description: 'Research the brand/colour landscape for design-tokens: competitor colours, free hue lanes, accessibility caveats',
  phases: [
    { title: 'Research', detail: 'fan out competitor / hue-occupancy / accessibility research' },
    { title: 'Synthesize', detail: 'merge into one landscape object with candidate accents' },
  ],
}

// args: { domain: string, competitors?: string[], constraintHue?: string }
const domain = (args && args.domain) || 'a software product'
const competitors = (args && args.competitors) || []
const constraint = (args && args.constraintHue) || ''

const PIN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pins'],
  properties: {
    pins: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'hsl'],
        properties: {
          name: { type: 'string' },
          hex: { type: 'string' },
          hsl: { type: 'number', description: 'HSL hue 0-360' },
        },
      },
    },
  },
}

const OCC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lanes'],
  properties: {
    lanes: {
      type: 'array',
      description: 'Free hue lanes: [hueStart, hueEnd, label]',
      items: { type: 'array', items: {}, minItems: 3, maxItems: 3 },
    },
    crowded: { type: 'array', items: { type: 'string' } },
  },
}

const A11Y_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['caveats'],
  properties: { caveats: { type: 'array', items: { type: 'string' } } },
}

const LANDSCAPE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pins', 'lanes', 'candidates', 'caveats'],
  properties: {
    pins: PIN_SCHEMA.properties.pins,
    lanes: OCC_SCHEMA.properties.lanes,
    caveats: A11Y_SCHEMA.properties.caveats,
    candidates: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'name', 'hex', 'hsl', 'lane', 'note'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          hex: { type: 'string' },
          hsl: { type: 'number' },
          lane: { type: 'string', description: 'free | busy | thin' },
          note: { type: 'string' },
        },
      },
    },
  },
}

const constraintLine = constraint ? `\nHard constraint: stay within ${constraint}.` : ''
const compLine = competitors.length ? `Prioritise these competitors/peers: ${competitors.join(', ')}.` : 'Pick the most relevant well-known products in this space.'

phase('Research')
const [comp, occ, a11y] = await parallel([
  () => agent(
    `Research the PRIMARY brand/accent colours of products relevant to ${domain}. ${compLine} ` +
    `Do real web searches; return each as a pin with name, hex, and HSL hue (0-360).${constraintLine}`,
    { label: 'competitor-colours', phase: 'Research', schema: PIN_SCHEMA }),
  () => agent(
    `Map the hue wheel (0-360, HSL) into CROWDED vs OPEN lanes for a ${domain} brand, based on which ` +
    `hues well-known tech/product brands already own. Return the 2-4 freest lanes as [hueStart,hueEnd,"free"] ` +
    `and a short list of crowded hue families.${constraintLine}`,
    { label: 'hue-occupancy', phase: 'Research', schema: OCC_SCHEMA }),
  () => agent(
    `List accessibility caveats for accent colours on a ${domain}: which hue/lightness ranges fail ` +
    `WCAG small-text contrast (e.g. yellow-greens on white), and the mitigation (darken for text, keep bright for fills).${constraintLine}`,
    { label: 'accessibility', phase: 'Research', schema: A11Y_SCHEMA }),
])

phase('Synthesize')
const landscape = await agent(
  `You are synthesising a colour landscape for ${domain}.${constraintLine}\n\n` +
  `Competitor pins: ${JSON.stringify((comp && comp.pins) || [])}\n` +
  `Free lanes: ${JSON.stringify((occ && occ.lanes) || [])} · crowded: ${JSON.stringify((occ && occ.crowded) || [])}\n` +
  `Accessibility caveats: ${JSON.stringify((a11y && a11y.caveats) || [])}\n\n` +
  `Produce 4-6 distinct accent CANDIDATES spanning free and (for contrast) a couple of busy lanes. ` +
  `Each: id (kebab), name, hex, hsl hue, lane ("free"|"busy"|"thin"), and a one-sentence note on why it stands out or clashes. ` +
  `Also pass through the pins, lanes, and caveats. Return the full landscape object.`,
  { label: 'synthesize', phase: 'Synthesize', schema: LANDSCAPE_SCHEMA })

return landscape
