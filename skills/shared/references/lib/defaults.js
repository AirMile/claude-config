// Shared default data structures for new dashboards

function createDefaultDashboardData(projectName) {
  return {
    concept: {
      name: projectName || "",
      content: "",
    },
    localUrl: "http://localhost:3000",
    theme: {
      colors: { main: [], accent: [], semantic: [] },
      typography: { families: { heading: "", body: "", mono: "" }, sizes: [] },
      spacing: { base: "", scale: [] },
      breakpoints: [],
      borderRadius: [],
      shadows: [],
      modes: {},
      cssVars: "",
    },
    stack: {
      framework: "",
      language: "",
      styling: "",
      db: "",
      auth: "",
      hosting: "",
      packages: [],
    },
    data: { entities: [] },
    endpoints: [],
    features: [],
    thinking: [],
  };
}

module.exports = { createDefaultDashboardData };
