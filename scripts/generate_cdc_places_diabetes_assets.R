#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(readr)
  library(sf)
  library(tigris)
  library(viridisLite)
})

script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
script_path <- if (length(script_arg)) normalizePath(sub("^--file=", "", script_arg[[1]])) else NA_character_
repo_root <- if (!is.na(script_path)) normalizePath(file.path(dirname(script_path), "..")) else getwd()
output_dir <- file.path(repo_root, "assets", "proposed-public-health")
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

options(tigris_use_cache = TRUE)
sf::sf_use_s2(FALSE)

places_url <- paste0(
  "https://data.cdc.gov/resource/i46a-9kgh.csv?",
  "%24select=stateabbr,statedesc,countyname,countyfips,totalpopulation,diabetes_crudeprev",
  "&stateabbr=TX&%24limit=5000"
)

places <- readr::read_csv(
  places_url,
  col_types = readr::cols(
    stateabbr = readr::col_character(),
    statedesc = readr::col_character(),
    countyname = readr::col_character(),
    countyfips = readr::col_character(),
    totalpopulation = readr::col_double(),
    diabetes_crudeprev = readr::col_double()
  )
) |>
  mutate(
    diabetes = diabetes_crudeprev,
    county_label = paste0(countyname, " County")
  )

if (nrow(places) == 0) {
  stop("No CDC PLACES rows were returned for Texas.")
}

class_breaks <- places$diabetes |>
  quantile(probs = seq(0, 1, length.out = 6), na.rm = TRUE, names = FALSE) |>
  round(1) |>
  unique()

if (length(class_breaks) < 6) {
  class_breaks <- pretty(places$diabetes, n = 5)
}

class_labels <- paste0(
  sprintf("%.1f", head(class_breaks, -1)),
  "-",
  sprintf("%.1f", tail(class_breaks, -1)),
  "%"
)

places <- places |>
  mutate(
    diabetes_class = cut(
      diabetes,
      breaks = class_breaks,
      labels = class_labels,
      include.lowest = TRUE
    )
  )

tx_counties <- tigris::counties(state = "TX", cb = TRUE, year = 2023, class = "sf") |>
  st_transform(3083) |>
  select(GEOID, NAME, geometry)

tx_map <- tx_counties |>
  left_join(places, by = c("GEOID" = "countyfips"))

if (any(is.na(tx_map$diabetes))) {
  missing_names <- tx_map |>
    st_drop_geometry() |>
    filter(is.na(diabetes)) |>
    pull(NAME)
  warning("Missing PLACES data for: ", paste(missing_names, collapse = ", "))
}

top_counties <- tx_map |>
  arrange(desc(diabetes)) |>
  slice_head(n = 12)

top_labels <- top_counties |>
  filter(countyname %in% c("Dimmit", "Jim Hogg", "Presidio")) |>
  st_point_on_surface() |>
  mutate(label = paste0(countyname, " ", sprintf("%.1f%%", diabetes)))

class_summary <- places |>
  count(diabetes_class, name = "county_count") |>
  mutate(
    diabetes_class = factor(diabetes_class, levels = class_labels),
    share = county_count / sum(county_count),
    label = paste0(county_count, " counties (", round(share * 100), "%)")
  ) |>
  arrange(diabetes_class)

fragile_palette <- c("#1b9e77", "#66a61e", "#e6ab02", "#d95f02", "#7570b3")
names(fragile_palette) <- class_labels

robust_palette <- viridisLite::cividis(length(class_labels), direction = -1)
names(robust_palette) <- class_labels

map_theme <- function() {
  theme_void(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = "#f8f6ee", color = NA),
      panel.background = element_rect(fill = "#f8f6ee", color = NA),
      plot.title = element_text(color = "#151d20", face = "bold", size = 22, margin = margin(b = 3)),
      plot.subtitle = element_text(color = "#4c5a5d", size = 11, margin = margin(b = 12)),
      plot.caption = element_text(color = "#687375", size = 8, hjust = 0, margin = margin(t = 12)),
      legend.position = c(0.83, 0.24),
      legend.title = element_text(color = "#151d20", face = "bold", size = 9),
      legend.text = element_text(color = "#283235", size = 8),
      legend.background = element_rect(fill = "#f8f6ee", color = "#d4d9d3", linewidth = 0.35),
      legend.key.height = unit(13, "pt"),
      legend.key.width = unit(18, "pt"),
      plot.margin = margin(24, 28, 20, 28)
    )
}

chart_theme <- function() {
  theme_minimal(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = "#f8f6ee", color = NA),
      panel.background = element_rect(fill = "#f8f6ee", color = NA),
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank(),
      panel.grid.major.x = element_line(color = "#d7ddd7", linewidth = 0.35),
      axis.title = element_text(color = "#283235", face = "bold", size = 9),
      axis.text = element_text(color = "#283235", size = 9),
      plot.title = element_text(color = "#151d20", face = "bold", size = 22, margin = margin(b = 3)),
      plot.subtitle = element_text(color = "#4c5a5d", size = 11, margin = margin(b = 12)),
      plot.caption = element_text(color = "#687375", size = 8, hjust = 0, margin = margin(t = 12)),
      legend.position = "bottom",
      legend.title = element_text(color = "#151d20", face = "bold", size = 9),
      legend.text = element_text(color = "#283235", size = 8),
      plot.margin = margin(24, 34, 20, 26)
    )
}

source_caption <- paste(
  "Source: CDC PLACES County Data GIS-Friendly Format, 2025 release;",
  "measure is crude prevalence of diagnosed diabetes among adults."
)

baseline_map <- ggplot(tx_map) +
  geom_sf(aes(fill = diabetes_class), color = "#ffffff", linewidth = 0.12) +
  geom_sf(fill = NA, color = "#1b2427", linewidth = 0.35) +
  scale_fill_manual(
    values = fragile_palette,
    drop = FALSE,
    na.translate = FALSE,
    na.value = "#d8d8cf",
    name = "Diagnosed diabetes"
  ) +
  labs(
    title = "Diagnosed Diabetes Prevalence by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    caption = source_caption
  ) +
  guides(fill = guide_legend(reverse = TRUE)) +
  map_theme()

baseline_chart <- ggplot(class_summary, aes(x = county_count, y = diabetes_class, fill = diabetes_class)) +
  geom_col(width = 0.72) +
  scale_fill_manual(
    values = fragile_palette,
    drop = FALSE,
    guide = "none"
  ) +
  scale_x_continuous(expand = expansion(mult = c(0, 0.13))) +
  labs(
    title = "County Count by Diabetes Prevalence Class",
    subtitle = "Same Texas county classes and colors as the map",
    x = "Number of counties",
    y = "Crude prevalence among adults",
    caption = source_caption
  ) +
  chart_theme()

redesign_map <- ggplot(tx_map) +
  geom_sf(aes(fill = diabetes_class), color = "#f8f6ee", linewidth = 0.16) +
  geom_sf(fill = NA, color = "#151d20", linewidth = 0.42) +
  geom_sf_label(
    data = top_labels,
    aes(label = label),
    family = "Arial",
    size = 3.1,
    fontface = "bold",
    linewidth = 0.24,
    label.padding = unit(0.17, "lines"),
    fill = "#f8f6ee",
    color = "#151d20"
  ) +
  scale_fill_manual(
    values = robust_palette,
    drop = FALSE,
    na.translate = FALSE,
    na.value = "#d8d8cf",
    name = "Diagnosed diabetes"
  ) +
  labs(
    title = "Diagnosed Diabetes Prevalence by County",
    subtitle = "Redesign: luminance-ordered palette, stronger boundaries, direct labels for selected high counties",
    caption = source_caption
  ) +
  guides(fill = guide_legend(reverse = TRUE)) +
  map_theme()

redesign_chart <- ggplot(class_summary, aes(x = county_count, y = diabetes_class, fill = diabetes_class)) +
  geom_col(width = 0.72, color = "#151d20", linewidth = 0.18) +
  geom_text(
    aes(label = label),
    hjust = -0.05,
    color = "#151d20",
    family = "Arial",
    fontface = "bold",
    size = 3.2
  ) +
  scale_fill_manual(values = robust_palette, drop = FALSE, guide = "none") +
  scale_x_continuous(expand = expansion(mult = c(0, 0.28))) +
  labs(
    title = "County Count by Diabetes Prevalence Class",
    subtitle = "Redesign: direct counts, percentages, and luminance-ordered colors",
    x = "Number of counties",
    y = "Crude prevalence among adults",
    caption = source_caption
  ) +
  chart_theme()

save_png <- function(plot, filename) {
  path <- file.path(output_dir, filename)
  ragg::agg_png(path, width = 1400, height = 980, units = "px", res = 144, background = "#f8f6ee")
  print(plot)
  dev.off()
  message("Wrote ", normalizePath(path))
}

save_png(baseline_map, "cdc-places-diabetes-map-baseline.png")
save_png(baseline_chart, "cdc-places-diabetes-chart-baseline.png")
save_png(redesign_map, "cdc-places-diabetes-map-redesign.png")
save_png(redesign_chart, "cdc-places-diabetes-chart-redesign.png")

readr::write_csv(
  places |> arrange(desc(diabetes)),
  file.path(output_dir, "cdc-places-diabetes-texas-counties.csv")
)

writeLines(
  c(
    "# Public Health Visualization Assets",
    "",
    "Generated by `scripts/generate_cdc_places_diabetes_assets.R`.",
    "",
    "Topic: diagnosed diabetes prevalence among adults by Texas county.",
    "",
    "Data source: CDC PLACES County Data GIS-Friendly Format, 2025 release.",
    "Dataset API: <https://data.cdc.gov/resource/i46a-9kgh>",
    "Boundary source: U.S. Census Bureau cartographic county boundaries via the `tigris` R package.",
    "",
    "Note: Loving County is drawn with the neutral missing-data fill because the CDC",
    "PLACES API did not return a 2025 county estimate for it.",
    "",
    "Candidate assets:",
    "",
    "- `cdc-places-diabetes-map-baseline.png`",
    "- `cdc-places-diabetes-chart-baseline.png`",
    "- `cdc-places-diabetes-map-redesign.png`",
    "- `cdc-places-diabetes-chart-redesign.png`",
    "- `cdc-places-diabetes-texas-counties.csv`"
  ),
  file.path(output_dir, "README.md")
)
