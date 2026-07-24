#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(grid)
  library(jsonlite)
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
set.seed(20260724)

places_url <- paste0(
  "https://data.cdc.gov/resource/i46a-9kgh.csv?",
  "%24select=stateabbr,statedesc,countyname,countyfips,totalpopulation,diabetes_crudeprev",
  "&stateabbr=TX&%24limit=5000"
)

svi_url <- paste0(
  "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/ArcGIS/rest/services/",
  "CDC_Texas_Social_Vulnerability_Index_County_2022/FeatureServer/0/query?",
  "where=1%3D1&outFields=STCNTY,COUNTY,RPL_THEME1,RPL_THEME2,RPL_THEME3,RPL_THEME4",
  "&returnGeometry=false&f=json"
)

places_col_types <- readr::cols(
  stateabbr = readr::col_character(),
  statedesc = readr::col_character(),
  countyname = readr::col_character(),
  countyfips = readr::col_character(),
  totalpopulation = readr::col_double(),
  diabetes_crudeprev = readr::col_double(),
  .default = readr::col_skip()
)

places <- tryCatch(
  readr::read_csv(
    places_url,
    col_types = places_col_types
  ),
  error = function(error) {
    local_places <- file.path(output_dir, "cdc-places-diabetes-texas-counties.csv")
    if (!file.exists(local_places)) {
      stop(error)
    }
    warning("CDC PLACES API unavailable; using cached county data at ", local_places)
    readr::read_csv(local_places, col_types = places_col_types)
  }
) |>
  mutate(
    diabetes = diabetes_crudeprev,
    county_label = paste0(countyname, " County")
  )

if (nrow(places) == 0) {
  stop("No CDC PLACES rows were returned for Texas.")
}

texas_average <- weighted.mean(places$diabetes, places$totalpopulation, na.rm = TRUE)

svi_theme_labels <- c(
  "Socioeconomic status",
  "Household characteristics",
  "Racial/ethnic minority status",
  "Housing/transportation"
)

svi_theme_short_labels <- c(
  "Socioeconomic status" = "Socioeconomic",
  "Household characteristics" = "Household",
  "Racial/ethnic minority status" = "Race/ethnicity",
  "Housing/transportation" = "Housing/transport"
)

read_svi_data <- function() {
  local_svi <- file.path(output_dir, "cdc-svi-texas-counties-2022.csv")
  svi_col_types <- readr::cols(
    STCNTY = readr::col_character(),
    COUNTY = readr::col_character(),
    RPL_THEME1 = readr::col_double(),
    RPL_THEME2 = readr::col_double(),
    RPL_THEME3 = readr::col_double(),
    RPL_THEME4 = readr::col_double(),
    .default = readr::col_skip()
  )

  tryCatch(
    {
      payload <- jsonlite::fromJSON(svi_url)
      if (!is.null(payload$error)) {
        stop(payload$error$message)
      }
      attributes <- payload$features$attributes
      readr::write_csv(attributes, local_svi)
      attributes
    },
    error = function(error) {
      if (!file.exists(local_svi)) {
        stop(error)
      }
      warning("CDC/ATSDR SVI service unavailable; using cached county data at ", local_svi)
      readr::read_csv(local_svi, col_types = svi_col_types)
    }
  )
}

svi <- read_svi_data() |>
  transmute(
    countyfips = STCNTY,
    svi_county = COUNTY,
    rpl_theme1 = RPL_THEME1,
    rpl_theme2 = RPL_THEME2,
    rpl_theme3 = RPL_THEME3,
    rpl_theme4 = RPL_THEME4
  ) |>
  rowwise() |>
  mutate(
    top_theme_index = which.max(c(rpl_theme1, rpl_theme2, rpl_theme3, rpl_theme4)),
    svi_theme = svi_theme_labels[[top_theme_index]],
    svi_theme = factor(svi_theme, levels = svi_theme_labels),
    svi_theme_short = unname(svi_theme_short_labels[as.character(svi_theme)]),
    top_theme_percentile = c(rpl_theme1, rpl_theme2, rpl_theme3, rpl_theme4)[[top_theme_index]]
  ) |>
  ungroup()

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

deviation_breaks <- c(-Inf, -4, -2, 0, 2, 4, Inf)
deviation_labels <- c(
  "4+ pts below",
  "2-4 pts below",
  "0-2 pts below",
  "0-2 pts above",
  "2-4 pts above",
  "4+ pts above"
)

places <- places |>
  mutate(
    diabetes_diff = diabetes - texas_average,
    diabetes_class = cut(
      diabetes,
      breaks = class_breaks,
      labels = class_labels,
      include.lowest = TRUE
    ),
    diabetes_difference_class = cut(
      diabetes_diff,
      breaks = deviation_breaks,
      labels = deviation_labels,
      include.lowest = TRUE,
      right = FALSE
    )
  )

tx_counties <- tigris::counties(state = "TX", cb = TRUE, year = 2023, class = "sf") |>
  st_transform(3083) |>
  select(GEOID, NAME, geometry)

tx_map <- tx_counties |>
  left_join(places, by = c("GEOID" = "countyfips")) |>
  left_join(svi, by = c("GEOID" = "countyfips"))

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

difference_summary <- data.frame(
  diabetes_difference_class = factor(deviation_labels, levels = deviation_labels)
) |>
  left_join(
    places |>
      count(diabetes_difference_class, name = "county_count"),
    by = "diabetes_difference_class"
  ) |>
  mutate(
    county_count = coalesce(county_count, 0L),
    side = if_else(grepl("above", diabetes_difference_class), "Above average", "Below average"),
    signed_count = if_else(side == "Above average", county_count, -county_count),
    y_index = as.numeric(diabetes_difference_class),
    xmin = pmin(signed_count, 0),
    xmax = pmax(signed_count, 0),
    ymin = y_index - 0.36,
    ymax = y_index + 0.36,
    label = paste0(county_count, " counties"),
    share_label = paste0(county_count, " counties (", round((county_count / sum(county_count)) * 100), "%)")
  )

svi_summary <- data.frame(
  svi_theme = factor(svi_theme_labels, levels = svi_theme_labels)
) |>
  left_join(
    svi |>
      count(svi_theme, name = "county_count"),
    by = "svi_theme"
  ) |>
  mutate(
    county_count = coalesce(county_count, 0L),
    share = county_count / sum(county_count),
    svi_theme_short = unname(svi_theme_short_labels[as.character(svi_theme)]),
    label = paste0(svi_theme_short, ": ", county_count, " counties (", round(share * 100), "%)")
  )

make_svi_chart_symbols <- function(summary_data) {
  bind_rows(lapply(seq_len(nrow(summary_data)), function(index) {
    row <- summary_data[index, ]
    xs <- seq(5, max(5, row$county_count - 3), by = 6)
    data.frame(
      x = xs,
      svi_theme = factor(as.character(row$svi_theme), levels = svi_theme_labels)
    )
  }))
}

svi_chart_symbols <- make_svi_chart_symbols(svi_summary)

make_chart_hatches <- function(summary_data) {
  rows <- summary_data |>
    filter(side == "Above average", county_count > 0)

  if (nrow(rows) == 0) {
    return(data.frame(x = numeric(), xend = numeric(), y = numeric(), yend = numeric()))
  }

  bind_rows(lapply(seq_len(nrow(rows)), function(index) {
    row <- rows[index, ]
    xs <- seq(1.8, max(1.8, row$signed_count - 1), by = 3.3)
    data.frame(
      x = xs - 1.0,
      xend = xs + 1.0,
      y = row$y_index - 0.34,
      yend = row$y_index + 0.34
    )
  }))
}

difference_bar_hatches <- make_chart_hatches(difference_summary)

above_stipple <- tx_map |>
  filter(!is.na(diabetes_diff), diabetes_diff >= 0) |>
  st_geometry() |>
  st_union() |>
  st_sample(size = 1100, type = "regular") |>
  st_as_sf()

difference_labels <- bind_rows(
  tx_map |>
    filter(!is.na(diabetes_diff)) |>
    arrange(desc(diabetes_diff)) |>
    slice_head(n = 2),
  tx_map |>
    filter(!is.na(diabetes_diff)) |>
    arrange(diabetes_diff) |>
    slice_head(n = 2)
) |>
  st_point_on_surface() |>
  mutate(
    label = paste0(
      countyname,
      " ",
      if_else(diabetes_diff >= 0, "+", ""),
      sprintf("%.1f pts", diabetes_diff)
    )
  )

make_svi_symbol_points <- function(map_data, labels, points_per_group = 220) {
  bind_rows(lapply(labels, function(label) {
    group_geometry <- map_data |>
      filter(svi_theme == label) |>
      st_geometry() |>
      st_union()

    samples <- st_sample(group_geometry, size = points_per_group, type = "regular")
    if (length(samples) == 0) {
      return(NULL)
    }

    st_sf(
      svi_theme = factor(label, levels = labels),
      geometry = samples,
      crs = st_crs(map_data)
    )
  }))
}

svi_symbol_points <- make_svi_symbol_points(tx_map, svi_theme_labels)

svi_label_points <- tx_map |>
  filter(!is.na(svi_theme)) |>
  group_by(svi_theme) |>
  slice_max(order_by = top_theme_percentile, n = 1, with_ties = FALSE) |>
  ungroup() |>
  st_point_on_surface() |>
  mutate(label = paste0(countyname, ": ", svi_theme_short))

fragile_palette <- c("#1b9e77", "#66a61e", "#e6ab02", "#d95f02", "#7570b3")
names(fragile_palette) <- class_labels

robust_palette <- viridisLite::cividis(length(class_labels), direction = -1)
names(robust_palette) <- class_labels

diverging_palette <- c("#2166ac", "#67a9cf", "#d1e5f0", "#fddbc7", "#ef8a62", "#b2182b")
names(diverging_palette) <- deviation_labels

diverging_redesign_palette <- c("#17375e", "#6f86a3", "#d6d9d2", "#eadf9f", "#a2833e", "#553d13")
names(diverging_redesign_palette) <- deviation_labels

svi_fragile_palette <- c("#69b887", "#c9ad4c", "#73aaa8", "#d58b63")
names(svi_fragile_palette) <- svi_theme_labels

svi_robust_palette <- c("#0072b2", "#d55e00", "#009e73", "#cc79a7")
names(svi_robust_palette) <- svi_theme_labels

svi_shapes <- c(16, 17, 15, 3)
names(svi_shapes) <- svi_theme_labels

map_theme <- function() {
  theme_void(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = "#f8f6ee", color = NA),
      panel.background = element_rect(fill = "#f8f6ee", color = NA),
      plot.title = element_text(color = "#151d20", face = "bold", size = 22, margin = margin(b = 3)),
      plot.subtitle = element_text(color = "#4c5a5d", size = 11, margin = margin(b = 12)),
      plot.caption = element_text(color = "#687375", size = 8, hjust = 0, margin = margin(t = 12)),
      legend.position = "none",
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
  "diagnosed diabetes crude prevalence among adults."
)

average_caption <- sprintf(
  "Estimated Texas average: %.1f%% (county population-weighted).",
  texas_average
)

svi_caption <- paste(
  "Source: CDC/ATSDR Social Vulnerability Index 2022 Texas county data;",
  "highest-ranked theme among four SVI theme percentile rankings."
)

map_legend_grob <- function(title, labels, palette, stipple_labels = character(), symbol_shapes = NULL) {
  legend_scale <- 1.6
  x <- unit(0.055, "npc")
  y <- unit(0.87, "npc")
  width <- unit(if (length(labels) <= 4) 0.27 * legend_scale else 0.2 * legend_scale, "npc")
  title_height <- unit(0.033 * legend_scale, "npc")
  row_height <- unit(0.025 * legend_scale, "npc")
  padding_x <- unit(0.012 * legend_scale, "npc")
  padding_top <- unit(0.013 * legend_scale, "npc")
  padding_bottom <- unit(0.012 * legend_scale, "npc")
  height <- padding_top + title_height + row_height * length(labels) + padding_bottom

  grobs <- list(
    rectGrob(
      x = x,
      y = y,
      width = width,
      height = height,
      just = c("left", "top"),
      gp = gpar(fill = NA, col = NA)
    ),
    textGrob(
      title,
      x = x + padding_x,
      y = y - padding_top,
      just = c("left", "top"),
      gp = gpar(col = "#151d20", fontsize = 9 * legend_scale, fontface = "bold", fontfamily = "Arial")
    )
  )

  key_left <- x + padding_x
  key_width <- unit(0.034 * legend_scale, "npc")
  key_height <- unit(0.017 * legend_scale, "npc")
  label_x <- key_left + key_width + unit(0.01 * legend_scale, "npc")

  for (index in seq_along(labels)) {
    label <- labels[[index]]
    row_y <- y - padding_top - title_height - row_height * (index - 0.5)
    fill <- unname(palette[[label]])

    grobs <- append(grobs, list(
      rectGrob(
        x = key_left,
        y = row_y,
        width = key_width,
        height = key_height,
        just = c("left", "center"),
        gp = gpar(fill = fill, col = "#d4d9d3", lwd = 0.6)
      )
    ))

    if (label %in% stipple_labels) {
      grobs <- append(grobs, list(
        pointsGrob(
          x = key_left + unit(rep(c(0.007, 0.016, 0.025) * legend_scale, 2), "npc"),
          y = row_y + unit(rep(c(-0.004, 0.004) * legend_scale, each = 3), "npc"),
          pch = 16,
          size = unit(0.55 * legend_scale, "mm"),
          gp = gpar(col = "#151d20", alpha = 0.68)
        )
      ))
    }

    if (!is.null(symbol_shapes) && label %in% names(symbol_shapes)) {
      grobs <- append(grobs, list(
        pointsGrob(
          x = key_left + key_width * 0.5,
          y = row_y,
          pch = unname(symbol_shapes[[label]]),
          size = unit(1.6 * legend_scale, "mm"),
          gp = gpar(col = "#151d20", alpha = 0.78)
        )
      ))
    }

    grobs <- append(grobs, list(
      textGrob(
        label,
        x = label_x,
        y = row_y,
        just = c("left", "center"),
        gp = gpar(col = "#283235", fontsize = 8 * legend_scale, fontfamily = "Arial")
      )
    ))
  }

  do.call(grobTree, grobs)
}

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

diverging_map_baseline <- ggplot(tx_map) +
  geom_sf(aes(fill = diabetes_difference_class), color = "#ffffff", linewidth = 0.12) +
  geom_sf(fill = NA, color = "#1b2427", linewidth = 0.35) +
  scale_fill_manual(
    values = diverging_palette,
    drop = FALSE,
    na.translate = FALSE,
    na.value = "#d8d8cf",
    name = "Difference"
  ) +
  labs(
    title = "Diagnosed Diabetes Relative to Texas Average",
    subtitle = average_caption,
    caption = source_caption
  ) +
  guides(fill = guide_legend(reverse = TRUE)) +
  map_theme()

diverging_chart_baseline <- ggplot(
  difference_summary
) +
  geom_vline(xintercept = 0, color = "#151d20", linewidth = 0.42) +
  geom_rect(
    aes(
      xmin = xmin,
      xmax = xmax,
      ymin = ymin,
      ymax = ymax,
      fill = diabetes_difference_class
    )
  ) +
  scale_fill_manual(values = diverging_palette, drop = FALSE, guide = "none") +
  scale_x_continuous(
    labels = abs,
    limits = max(abs(difference_summary$signed_count)) * c(-1.18, 1.18),
    expand = expansion(mult = 0)
  ) +
  scale_y_continuous(
    breaks = seq_along(deviation_labels),
    labels = deviation_labels,
    expand = expansion(add = 0.45)
  ) +
  labs(
    title = "County Count Above and Below Texas Average",
    subtitle = "Same diverging classes and colors as the map",
    x = "Number of counties",
    y = "Difference from Texas average",
    caption = source_caption
  ) +
  chart_theme()

diverging_map_redesign <- ggplot(tx_map) +
  geom_sf(aes(fill = diabetes_difference_class), color = "#f8f6ee", linewidth = 0.16) +
  geom_sf(data = above_stipple, inherit.aes = FALSE, color = "#151d20", size = 0.18, alpha = 0.5) +
  geom_sf(fill = NA, color = "#151d20", linewidth = 0.42) +
  geom_sf_label(
    data = difference_labels,
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
    values = diverging_redesign_palette,
    drop = FALSE,
    na.translate = FALSE,
    na.value = "#d8d8cf",
    name = "Difference"
  ) +
  labs(
    title = "Diagnosed Diabetes Relative to Texas Average",
    subtitle = "Redesign: above-average counties are stippled; labels show selected high and low differences",
    caption = source_caption
  ) +
  guides(fill = guide_legend(reverse = TRUE)) +
  map_theme()

diverging_chart_redesign <- ggplot(
  difference_summary
) +
  geom_vline(xintercept = 0, color = "#151d20", linewidth = 0.48) +
  geom_rect(
    aes(
      xmin = xmin,
      xmax = xmax,
      ymin = ymin,
      ymax = ymax,
      fill = diabetes_difference_class
    ),
    color = "#151d20",
    linewidth = 0.18
  ) +
  geom_segment(
    data = difference_bar_hatches,
    aes(x = x, xend = xend, y = y, yend = yend),
    inherit.aes = FALSE,
    color = "#151d20",
    linewidth = 0.34,
    alpha = 0.68
  ) +
  geom_text(
    aes(
      x = signed_count + if_else(signed_count >= 0, 2.0, -2.0),
      y = y_index,
      label = share_label,
      hjust = if_else(signed_count >= 0, 0, 1)
    ),
    color = "#151d20",
    family = "Arial",
    fontface = "bold",
    size = 3.2
  ) +
  scale_fill_manual(values = diverging_redesign_palette, drop = FALSE, guide = "none") +
  scale_x_continuous(
    labels = abs,
    limits = max(abs(difference_summary$signed_count)) * c(-1.42, 1.42),
    expand = expansion(mult = 0)
  ) +
  scale_y_continuous(
    breaks = seq_along(deviation_labels),
    labels = deviation_labels,
    expand = expansion(add = 0.45)
  ) +
  labs(
    title = "County Count Above and Below Texas Average",
    subtitle = "Redesign: above-average bars use redundant hash marks and direct labels",
    x = "Number of counties",
    y = "Difference from Texas average",
    caption = source_caption
  ) +
  chart_theme()

save_png <- function(plot, filename, legend = NULL) {
  path <- file.path(output_dir, filename)
  ragg::agg_png(path, width = 1400, height = 980, units = "px", res = 144, background = "#f8f6ee")
  print(plot)
  if (!is.null(legend)) {
    grid.draw(legend)
  }
  dev.off()
  message("Wrote ", normalizePath(path))
}

intervention_grid <- expand.grid(
  palette = c(FALSE, TRUE),
  redundant = c(FALSE, TRUE),
  labels = c(FALSE, TRUE),
  KEEP.OUT.ATTRS = FALSE
)

intervention_suffix <- function(palette, redundant, labels) {
  paste0(
    "p", as.integer(palette),
    "-r", as.integer(redundant),
    "-l", as.integer(labels)
  )
}

intervention_subtitle <- function(original, named_interventions) {
  active <- named_interventions[named_interventions != ""]
  if (length(active) == 0) {
    return(original)
  }
  paste("Active interventions:", paste(active, collapse = "; "))
}

make_prevalence_map <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) robust_palette else fragile_palette
  boundary_color <- if (redundant) "#151d20" else "#1b2427"
  county_line <- if (redundant) 0.18 else 0.12
  outline_line <- if (redundant) 0.46 else 0.35

  plot <- ggplot(tx_map) +
    geom_sf(aes(fill = diabetes_class), color = if (redundant) "#f8f6ee" else "#ffffff", linewidth = county_line) +
    geom_sf(fill = NA, color = boundary_color, linewidth = outline_line)

  if (labels) {
    plot <- plot +
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
      )
  }

  plot +
    scale_fill_manual(
      values = fill_palette,
      drop = FALSE,
      na.translate = FALSE,
      na.value = "#d8d8cf",
      name = "Diagnosed diabetes"
    ) +
    labs(
      title = "Diagnosed Diabetes Prevalence by County",
      subtitle = intervention_subtitle(
        "Original: hue-dependent prevalence classes",
        c(
          if (palette) "ordered luminance palette" else "",
          if (redundant) "stronger county boundaries" else "",
          if (labels) "selected direct labels" else ""
        )
      ),
      caption = source_caption
    ) +
    guides(fill = guide_legend(reverse = TRUE)) +
    map_theme()
}

make_prevalence_chart <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) robust_palette else fragile_palette
  plot <- ggplot(class_summary, aes(x = county_count, y = diabetes_class, fill = diabetes_class)) +
    geom_col(
      width = 0.72,
      color = if (redundant) "#151d20" else NA,
      linewidth = if (redundant) 0.18 else 0
    )

  if (labels) {
    plot <- plot +
      geom_text(
        aes(label = label),
        hjust = -0.05,
        color = "#151d20",
        family = "Arial",
        fontface = "bold",
        size = 3.2
      )
  }

  plot +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    scale_x_continuous(expand = expansion(mult = c(0, if (labels) 0.28 else 0.13))) +
    labs(
      title = "County Count by Diabetes Prevalence Class",
      subtitle = intervention_subtitle(
        "Original: same hue-dependent classes as the map",
        c(
          if (palette) "ordered luminance palette" else "",
          if (redundant) "bar outlines" else "",
          if (labels) "direct counts and percentages" else ""
        )
      ),
      x = "Number of counties",
      y = "Crude prevalence among adults",
      caption = source_caption
    ) +
    chart_theme()
}

make_diverging_map <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) diverging_redesign_palette else diverging_palette
  refined_outline <- palette || redundant || labels
  plot <- ggplot(tx_map) +
    geom_sf(
      aes(fill = diabetes_difference_class),
      color = if (refined_outline) "#f8f6ee" else "#ffffff",
      linewidth = if (refined_outline) 0.16 else 0.12
    )

  if (redundant) {
    plot <- plot +
      geom_sf(data = above_stipple, inherit.aes = FALSE, color = "#151d20", size = 0.18, alpha = 0.5)
  }

  plot <- plot +
    geom_sf(
      fill = NA,
      color = if (refined_outline) "#151d20" else "#1b2427",
      linewidth = if (refined_outline) 0.42 else 0.35
    )

  if (labels) {
    plot <- plot +
      geom_sf_label(
        data = difference_labels,
        aes(label = label),
        family = "Arial",
        size = 3.1,
        fontface = "bold",
        linewidth = 0.24,
        label.padding = unit(0.17, "lines"),
        fill = "#f8f6ee",
        color = "#151d20"
      )
  }

  plot +
    scale_fill_manual(
      values = fill_palette,
      drop = FALSE,
      na.translate = FALSE,
      na.value = "#d8d8cf",
      name = "Difference"
    ) +
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = intervention_subtitle(
        average_caption,
        c(
          if (palette) "distinguishable diverging palette" else "",
          if (redundant) "above-average stippling" else "",
          if (labels) "selected high/low labels" else ""
        )
      ),
      caption = source_caption
    ) +
    guides(fill = guide_legend(reverse = TRUE)) +
    map_theme()
}

make_diverging_chart <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) diverging_redesign_palette else diverging_palette
  x_limit_multiplier <- if (labels) 1.42 else 1.18
  plot <- ggplot(difference_summary) +
    geom_vline(xintercept = 0, color = "#151d20", linewidth = if (redundant || labels) 0.48 else 0.42) +
    geom_rect(
      aes(
        xmin = xmin,
        xmax = xmax,
        ymin = ymin,
        ymax = ymax,
        fill = diabetes_difference_class
      ),
      color = if (redundant || labels) "#151d20" else NA,
      linewidth = if (redundant || labels) 0.18 else 0
    )

  if (redundant) {
    plot <- plot +
      geom_segment(
        data = difference_bar_hatches,
        aes(x = x, xend = xend, y = y, yend = yend),
        inherit.aes = FALSE,
        color = "#151d20",
        linewidth = 0.34,
        alpha = 0.68
      )
  }

  if (labels) {
    plot <- plot +
      geom_text(
        aes(
          x = signed_count + if_else(signed_count >= 0, 2.0, -2.0),
          y = y_index,
          label = share_label,
          hjust = if_else(signed_count >= 0, 0, 1)
        ),
        color = "#151d20",
        family = "Arial",
        fontface = "bold",
        size = 3.2
      )
  }

  plot +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    scale_x_continuous(
      labels = abs,
      limits = max(abs(difference_summary$signed_count)) * c(-x_limit_multiplier, x_limit_multiplier),
      expand = expansion(mult = 0)
    ) +
    scale_y_continuous(
      breaks = seq_along(deviation_labels),
      labels = deviation_labels,
      expand = expansion(add = 0.45)
    ) +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = intervention_subtitle(
        "Original: same diverging classes and colors as the map",
        c(
          if (palette) "distinguishable diverging palette" else "",
          if (redundant) "above-average hash marks" else "",
          if (labels) "direct counts and percentages" else ""
        )
      ),
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_theme()
}

make_categorical_map <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) svi_robust_palette else svi_fragile_palette
  refined_outline <- palette || redundant || labels

  plot <- ggplot(tx_map) +
    geom_sf(
      aes(fill = svi_theme),
      color = if (refined_outline) "#f8f6ee" else "#ffffff",
      linewidth = if (refined_outline) 0.16 else 0.12
    )

  if (redundant) {
    plot <- plot +
      geom_sf(
        data = svi_symbol_points,
        aes(shape = svi_theme),
        inherit.aes = FALSE,
        color = "#151d20",
        size = 0.42,
        alpha = 0.58
      )
  }

  plot <- plot +
    geom_sf(
      fill = NA,
      color = if (refined_outline) "#151d20" else "#1b2427",
      linewidth = if (refined_outline) 0.42 else 0.35
    )

  if (labels) {
    plot <- plot +
      geom_sf_label(
        data = svi_label_points,
        aes(label = label),
        family = "Arial",
        size = 3.0,
        fontface = "bold",
        linewidth = 0.24,
        label.padding = unit(0.16, "lines"),
        fill = "#f8f6ee",
        color = "#151d20"
      )
  }

  plot +
    scale_fill_manual(
      values = fill_palette,
      drop = FALSE,
      na.translate = FALSE,
      na.value = "#d8d8cf",
      name = "Highest SVI theme"
    ) +
    scale_shape_manual(values = svi_shapes, guide = "none") +
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = intervention_subtitle(
        "Original: theme identity relies on similarly valued hues",
        c(
          if (palette) "safer qualitative palette" else "",
          if (redundant) "theme-specific symbols" else "",
          if (labels) "selected county callouts" else ""
        )
      ),
      caption = svi_caption
    ) +
    guides(fill = guide_legend(reverse = TRUE)) +
    map_theme()
}

make_categorical_chart <- function(palette = FALSE, redundant = FALSE, labels = FALSE) {
  fill_palette <- if (palette) svi_robust_palette else svi_fragile_palette
  plot <- ggplot(svi_summary, aes(x = county_count, y = svi_theme, fill = svi_theme)) +
    geom_col(
      width = 0.72,
      color = if (redundant) "#151d20" else NA,
      linewidth = if (redundant) 0.18 else 0
    )

  if (redundant) {
    plot <- plot +
      geom_point(
        data = svi_chart_symbols,
        aes(x = x, y = svi_theme, shape = svi_theme),
        inherit.aes = FALSE,
        color = "#151d20",
        size = 1.4,
        alpha = 0.7
      )
  }

  plot +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    scale_shape_manual(values = svi_shapes, guide = "none") +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    scale_x_continuous(expand = expansion(mult = c(0, 0.14))) +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = intervention_subtitle(
        "Original: bars keep labels, but color still carries cross-view identity",
        c(
          if (palette) "safer qualitative palette" else "",
          if (redundant) "matching theme symbols" else "",
          if (labels) "selected county callouts on map" else ""
        )
      ),
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_theme()
}

save_intervention_assets <- function() {
  for (index in seq_len(nrow(intervention_grid))) {
    palette <- intervention_grid$palette[[index]]
    redundant <- intervention_grid$redundant[[index]]
    labels <- intervention_grid$labels[[index]]
    suffix <- intervention_suffix(palette, redundant, labels)

    save_png(
      make_prevalence_map(palette, redundant, labels),
      paste0("cdc-places-diabetes-map-", suffix, ".png"),
      legend = map_legend_grob(
        "Diagnosed diabetes",
        rev(class_labels),
        if (palette) robust_palette else fragile_palette
      )
    )
    save_png(
      make_prevalence_chart(palette, redundant, labels),
      paste0("cdc-places-diabetes-chart-", suffix, ".png")
    )
    save_png(
      make_diverging_map(palette, redundant, labels),
      paste0("cdc-places-diabetes-diverging-map-", suffix, ".png"),
      legend = map_legend_grob(
        "Difference",
        rev(deviation_labels),
        if (palette) diverging_redesign_palette else diverging_palette,
        stipple_labels = if (redundant) rev(deviation_labels)[grepl("above", rev(deviation_labels))] else character()
      )
    )
    save_png(
      make_diverging_chart(palette, redundant, labels),
      paste0("cdc-places-diabetes-diverging-chart-", suffix, ".png")
    )
    save_png(
      make_categorical_map(palette, redundant, labels),
      paste0("cdc-svi-theme-map-", suffix, ".png"),
      legend = map_legend_grob(
        "Highest SVI theme",
        rev(svi_theme_labels),
        if (palette) svi_robust_palette else svi_fragile_palette,
        symbol_shapes = if (redundant) svi_shapes else NULL
      )
    )
    save_png(
      make_categorical_chart(palette, redundant, labels),
      paste0("cdc-svi-theme-chart-", suffix, ".png")
    )
  }
}

save_png(
  baseline_map,
  "cdc-places-diabetes-map-baseline.png",
  legend = map_legend_grob("Diagnosed diabetes", rev(class_labels), fragile_palette)
)
save_png(baseline_chart, "cdc-places-diabetes-chart-baseline.png")
save_png(
  redesign_map,
  "cdc-places-diabetes-map-redesign.png",
  legend = map_legend_grob("Diagnosed diabetes", rev(class_labels), robust_palette)
)
save_png(redesign_chart, "cdc-places-diabetes-chart-redesign.png")
save_png(
  diverging_map_baseline,
  "cdc-places-diabetes-diverging-map-baseline.png",
  legend = map_legend_grob("Difference", rev(deviation_labels), diverging_palette)
)
save_png(diverging_chart_baseline, "cdc-places-diabetes-diverging-chart-baseline.png")
save_png(
  diverging_map_redesign,
  "cdc-places-diabetes-diverging-map-redesign.png",
  legend = map_legend_grob(
    "Difference",
    rev(deviation_labels),
    diverging_redesign_palette,
    stipple_labels = rev(deviation_labels)[grepl("above", rev(deviation_labels))]
  )
)
save_png(diverging_chart_redesign, "cdc-places-diabetes-diverging-chart-redesign.png")
save_png(
  make_categorical_map(FALSE, FALSE, FALSE),
  "cdc-svi-theme-map-baseline.png",
  legend = map_legend_grob("Highest SVI theme", rev(svi_theme_labels), svi_fragile_palette)
)
save_png(make_categorical_chart(FALSE, FALSE, FALSE), "cdc-svi-theme-chart-baseline.png")
save_png(
  make_categorical_map(TRUE, TRUE, FALSE),
  "cdc-svi-theme-map-redesign.png",
  legend = map_legend_grob(
    "Highest SVI theme",
    rev(svi_theme_labels),
    svi_robust_palette,
    symbol_shapes = svi_shapes
  )
)
save_png(make_categorical_chart(TRUE, TRUE, FALSE), "cdc-svi-theme-chart-redesign.png")

save_intervention_assets()

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
    "Topics: diagnosed diabetes prevalence and CDC/ATSDR Social Vulnerability Index themes by Texas county.",
    "",
    "Data source: CDC PLACES County Data GIS-Friendly Format, 2025 release.",
    "Dataset API: <https://data.cdc.gov/resource/i46a-9kgh>",
    "Data source: CDC/ATSDR Social Vulnerability Index 2022 Texas county data.",
    "SVI service: <https://services2.arcgis.com/LYMgRMwHfrWWEg3s/ArcGIS/rest/services/CDC_Texas_Social_Vulnerability_Index_County_2022/FeatureServer>",
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
    "- `cdc-places-diabetes-diverging-map-baseline.png`",
    "- `cdc-places-diabetes-diverging-chart-baseline.png`",
    "- `cdc-places-diabetes-diverging-map-redesign.png`",
    "- `cdc-places-diabetes-diverging-chart-redesign.png`",
    "- `cdc-svi-theme-map-baseline.png`",
    "- `cdc-svi-theme-chart-baseline.png`",
    "- `cdc-svi-theme-map-redesign.png`",
    "- `cdc-svi-theme-chart-redesign.png`",
    "",
    "The categorical example maps the SVI theme with the highest county percentile",
    "ranking. The four categories are socioeconomic status, household characteristics,",
    "racial/ethnic minority status, and housing/transportation. The theme colors encode",
    "nominal identity, not rank.",
    "",
    "Intervention-combination assets use the suffix pattern",
    "`p{0|1}-r{0|1}-l{0|1}`:",
    "",
    "- `p`: palette or luminance intervention",
    "- `r`: redundant cue intervention",
    "- `l`: labels, annotations, or optional callouts intervention",
    "",
    "For example, `cdc-places-diabetes-diverging-map-p1-r0-l1.png`",
    "uses the diverging palette and labels, but not the above-average pattern.",
    "There are eight combinations for each example, each exported as map and chart PNGs.",
    "",
    "- `cdc-places-diabetes-texas-counties.csv`",
    "- `cdc-svi-texas-counties-2022.csv`"
  ),
  file.path(output_dir, "README.md")
)
