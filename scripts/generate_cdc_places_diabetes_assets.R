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

transfer_required_fields <- c(
  "stateabbr",
  "statedesc",
  "countyname",
  "countyfips",
  "totalpopulation",
  "obesity_crudeprev",
  "lpa_crudeprev",
  "csmoking_crudeprev",
  "depression_crudeprev",
  "bphigh_crudeprev",
  "access2_crudeprev"
)

transfer_url <- paste0(
  "https://data.cdc.gov/resource/i46a-9kgh.csv?",
  "%24select=", paste(transfer_required_fields, collapse = ","),
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

transfer_col_types <- readr::cols(
  stateabbr = readr::col_character(),
  statedesc = readr::col_character(),
  countyname = readr::col_character(),
  countyfips = readr::col_character(),
  totalpopulation = readr::col_double(),
  obesity_crudeprev = readr::col_double(),
  lpa_crudeprev = readr::col_double(),
  csmoking_crudeprev = readr::col_double(),
  depression_crudeprev = readr::col_double(),
  bphigh_crudeprev = readr::col_double(),
  access2_crudeprev = readr::col_double(),
  .default = readr::col_skip()
)

validate_required_columns <- function(data, columns, source_name) {
  missing_columns <- setdiff(columns, names(data))
  if (length(missing_columns) > 0) {
    stop(
      source_name,
      " is missing required CDC PLACES field(s): ",
      paste(missing_columns, collapse = ", ")
    )
  }
  data
}

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

read_transfer_places_data <- function() {
  local_transfer <- file.path(output_dir, "cdc-places-transfer-texas-counties.csv")

  raw_transfer <- tryCatch(
    {
      data <- readr::read_csv(transfer_url, col_types = transfer_col_types)
      validate_required_columns(data, transfer_required_fields, "CDC PLACES transfer query")
      readr::write_csv(data, local_transfer)
      data
    },
    error = function(error) {
      if (!file.exists(local_transfer)) {
        stop(error)
      }
      warning("CDC PLACES transfer API unavailable; using cached county data at ", local_transfer)
      readr::read_csv(local_transfer, col_types = transfer_col_types)
    }
  )

  raw_transfer |>
    validate_required_columns(transfer_required_fields, "cached CDC PLACES transfer data") |>
    transmute(
      countyfips,
      transfer_population = totalpopulation,
      obesity = obesity_crudeprev,
      inactivity = lpa_crudeprev,
      smoking = csmoking_crudeprev,
      depression = depression_crudeprev,
      blood_pressure = bphigh_crudeprev,
      uninsured = access2_crudeprev
    )
}

transfer_places <- read_transfer_places_data()

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

deviation_simple_breaks <- c(-Inf, -2, 0, 2, Inf)
deviation_simple_labels <- c(
  "2+ pts below",
  "0-2 pts below",
  "0-2 pts above",
  "2+ pts above"
)

deviation_direction_breaks <- c(-Inf, 0, Inf)
deviation_direction_labels <- c(
  "Below average",
  "Above average"
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
    ),
    diabetes_difference_simple_class = cut(
      diabetes_diff,
      breaks = deviation_simple_breaks,
      labels = deviation_simple_labels,
      include.lowest = TRUE,
      right = FALSE
    ),
    diabetes_difference_direction_class = cut(
      diabetes_diff,
      breaks = deviation_direction_breaks,
      labels = deviation_direction_labels,
      include.lowest = TRUE,
      right = FALSE
    )
  )

tx_counties <- tigris::counties(state = "TX", cb = TRUE, year = 2023, class = "sf") |>
  st_transform(3083) |>
  select(GEOID, NAME, geometry)

tx_map <- tx_counties |>
  left_join(places, by = c("GEOID" = "countyfips")) |>
  left_join(svi, by = c("GEOID" = "countyfips")) |>
  left_join(transfer_places, by = c("GEOID" = "countyfips"))

tx_outline <- tx_map |>
  summarise(geometry = st_union(geometry))

map_neatline <- st_sf(
  geometry = st_as_sfc(st_bbox(tx_map)),
  crs = st_crs(tx_map)
)

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

all_county_labels <- tx_map |>
  filter(!is.na(diabetes), !is.na(countyname)) |>
  st_point_on_surface() |>
  mutate(label = countyname)

class_summary <- places |>
  count(diabetes_class, name = "county_count") |>
  mutate(
    diabetes_class = factor(diabetes_class, levels = class_labels),
    share = county_count / sum(county_count),
    label = paste0(county_count, " counties (", round(share * 100), "%)")
  ) |>
  arrange(diabetes_class)

make_difference_summary <- function(class_column, labels) {
  class_counts <- places |>
    transmute(diabetes_difference_class = .data[[class_column]]) |>
    count(diabetes_difference_class, name = "county_count")

  data.frame(
    diabetes_difference_class = factor(labels, levels = labels)
  ) |>
    left_join(class_counts, by = "diabetes_difference_class") |>
    mutate(
      county_count = coalesce(county_count, 0L),
      side = if_else(grepl("above", diabetes_difference_class, ignore.case = TRUE), "Above average", "Below average"),
      signed_count = if_else(side == "Above average", county_count, -county_count),
      y_index = as.numeric(diabetes_difference_class),
      xmin = pmin(signed_count, 0),
      xmax = pmax(signed_count, 0),
      ymin = y_index - 0.36,
      ymax = y_index + 0.36,
      label = paste0(county_count, " counties"),
      share_label = paste0(county_count, " counties (", round((county_count / sum(county_count)) * 100), "%)")
    )
}

difference_summary <- make_difference_summary("diabetes_difference_class", deviation_labels)
difference_summary_simple <- make_difference_summary("diabetes_difference_simple_class", deviation_simple_labels)
difference_summary_direction <- make_difference_summary("diabetes_difference_direction_class", deviation_direction_labels)

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
    label = paste0(county_count, " counties (", round(share * 100), "%)")
  )

svi_shapes <- c(21, 24, 22, 23)
names(svi_shapes) <- svi_theme_labels

svi_symbol_fills <- c("#151d20", "#f8f6ee", "#151d20", "#f8f6ee")
names(svi_symbol_fills) <- svi_theme_labels

svi_symbol_outlines <- svi_symbol_fills
names(svi_symbol_outlines) <- svi_theme_labels

svi_points_per_county <- c(1, 2, 3, 5)
names(svi_points_per_county) <- svi_theme_labels

svi_chart_symbol_spacing <- c(16, 10, 7, 4.5)
names(svi_chart_symbol_spacing) <- svi_theme_labels

svi_map_symbol_sizes <- c(0.72, 0.84, 0.72, 0.9)
names(svi_map_symbol_sizes) <- svi_theme_labels

svi_chart_symbol_sizes <- c(2.35, 2.55, 2.35, 2.7)
names(svi_chart_symbol_sizes) <- svi_theme_labels

svi_legend_symbol_sizes <- c(1.45, 1.6, 1.45, 1.68)
names(svi_legend_symbol_sizes) <- svi_theme_labels

svi_legend_symbol_counts <- c(1, 2, 3, 4)
names(svi_legend_symbol_counts) <- svi_theme_labels

svi_cue_alt_shapes <- rep(21, length(svi_theme_labels))
names(svi_cue_alt_shapes) <- svi_theme_labels

svi_cue_alt_symbol_fills <- c("#2364aa", "#d04f31", "#6b9f28", "#8a63b8")
names(svi_cue_alt_symbol_fills) <- svi_theme_labels

svi_cue_alt_symbol_outlines <- rep("#151d20", length(svi_theme_labels))
names(svi_cue_alt_symbol_outlines) <- svi_theme_labels

svi_cue_alt_points_per_county <- rep(3, length(svi_theme_labels))
names(svi_cue_alt_points_per_county) <- svi_theme_labels

svi_cue_alt_chart_symbol_spacing <- rep(8, length(svi_theme_labels))
names(svi_cue_alt_chart_symbol_spacing) <- svi_theme_labels

svi_cue_alt_map_symbol_sizes <- rep(0.82, length(svi_theme_labels))
names(svi_cue_alt_map_symbol_sizes) <- svi_theme_labels

svi_cue_alt_chart_symbol_sizes <- rep(2.45, length(svi_theme_labels))
names(svi_cue_alt_chart_symbol_sizes) <- svi_theme_labels

svi_cue_alt_legend_symbol_sizes <- rep(1.55, length(svi_theme_labels))
names(svi_cue_alt_legend_symbol_sizes) <- svi_theme_labels

svi_cue_alt_legend_symbol_counts <- rep(3, length(svi_theme_labels))
names(svi_cue_alt_legend_symbol_counts) <- svi_theme_labels

make_svi_chart_symbols <- function(summary_data) {
  bind_rows(lapply(seq_len(nrow(summary_data)), function(index) {
    row <- summary_data[index, ]
    spacing <- unname(svi_chart_symbol_spacing[[as.character(row$svi_theme)]])
    xs <- seq(5, max(5, row$county_count - 3), by = spacing)
    data.frame(
      x = xs,
      svi_theme = factor(as.character(row$svi_theme), levels = svi_theme_labels)
    )
  }))
}

svi_chart_symbols <- make_svi_chart_symbols(svi_summary)

make_svi_chart_symbols_equal <- function(summary_data) {
  bind_rows(lapply(seq_len(nrow(summary_data)), function(index) {
    row <- summary_data[index, ]
    spacing <- unname(svi_cue_alt_chart_symbol_spacing[[as.character(row$svi_theme)]])
    xs <- seq(5, max(5, row$county_count - 3), by = spacing)
    data.frame(
      x = xs,
      svi_theme = factor(as.character(row$svi_theme), levels = svi_theme_labels)
    )
  }))
}

svi_chart_symbols_alt <- make_svi_chart_symbols_equal(svi_summary)

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
difference_bar_hatches_simple <- make_chart_hatches(difference_summary_simple)
difference_bar_hatches_direction <- make_chart_hatches(difference_summary_direction)

make_chart_below_points <- function(summary_data) {
  rows <- summary_data |>
    filter(side == "Below average", county_count > 0)

  if (nrow(rows) == 0) {
    return(data.frame(x = numeric(), y = numeric()))
  }

  bind_rows(lapply(seq_len(nrow(rows)), function(index) {
    row <- rows[index, ]
    xs <- seq(-1.8, min(-1.8, row$signed_count + 1), by = -3.6)
    data.frame(
      x = xs,
      y = row$y_index
    )
  }))
}

difference_bar_below_points <- make_chart_below_points(difference_summary)
difference_bar_below_points_simple <- make_chart_below_points(difference_summary_simple)
difference_bar_below_points_direction <- make_chart_below_points(difference_summary_direction)

above_stipple <- tx_map |>
  filter(!is.na(diabetes_diff), diabetes_diff >= 0) |>
  st_geometry() |>
  st_union() |>
  st_sample(size = 1100, type = "regular") |>
  st_as_sf()

below_stipple <- tx_map |>
  filter(!is.na(diabetes_diff), diabetes_diff < 0) |>
  st_geometry() |>
  st_union() |>
  st_sample(size = 760, type = "regular") |>
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

all_difference_labels <- tx_map |>
  filter(!is.na(diabetes_diff), !is.na(countyname)) |>
  st_point_on_surface() |>
  mutate(label = countyname)

make_svi_symbol_points <- function(map_data, labels) {
  bind_rows(lapply(labels, function(label) {
    group_count <- unname(svi_points_per_county[[label]])
    group_counties <- map_data |>
      filter(svi_theme == label) |>
      select(svi_theme, geometry)

    bind_rows(lapply(seq_len(nrow(group_counties)), function(index) {
      county <- group_counties[index, ]
      samples <- st_sample(st_geometry(county), size = group_count, type = "regular")
      if (length(samples) == 0) {
        samples <- st_geometry(st_point_on_surface(county))
      }

      st_sf(
        svi_theme = factor(label, levels = labels),
        geometry = samples,
        crs = st_crs(map_data)
      )
    }))
  }))
}

svi_symbol_points <- make_svi_symbol_points(tx_map, svi_theme_labels)

make_svi_equal_circle_points <- function(map_data, labels) {
  bind_rows(lapply(labels, function(label) {
    group_count <- unname(svi_cue_alt_points_per_county[[label]])
    group_counties <- map_data |>
      filter(svi_theme == label) |>
      select(svi_theme, geometry)

    bind_rows(lapply(seq_len(nrow(group_counties)), function(index) {
      county <- group_counties[index, ]
      samples <- st_sample(st_geometry(county), size = group_count, type = "regular")
      if (length(samples) == 0) {
        samples <- st_geometry(st_point_on_surface(county))
      }

      st_sf(
        svi_theme = factor(label, levels = labels),
        geometry = samples,
        crs = st_crs(map_data)
      )
    }))
  }))
}

svi_symbol_points_alt <- make_svi_equal_circle_points(tx_map, svi_theme_labels)

svi_label_points <- tx_map |>
  filter(!is.na(svi_theme)) |>
  group_by(svi_theme) |>
  slice_max(order_by = top_theme_percentile, n = 1, with_ties = FALSE) |>
  ungroup() |>
  st_point_on_surface() |>
  mutate(label = paste0(countyname, ": ", svi_theme_short))

all_svi_labels <- tx_map |>
  filter(!is.na(svi_theme), !is.na(countyname)) |>
  st_point_on_surface() |>
  mutate(label = countyname)

add_svi_map_symbol_layers <- function(plot, symbol_data) {
  for (label in svi_theme_labels) {
    label_points <- symbol_data |>
      filter(svi_theme == label)

    if (nrow(label_points) == 0) {
      next
    }

    plot <- plot +
      geom_sf(
        data = label_points,
        inherit.aes = FALSE,
        shape = unname(svi_shapes[[label]]),
        fill = unname(svi_symbol_fills[[label]]),
        color = unname(svi_symbol_outlines[[label]]),
        size = unname(svi_map_symbol_sizes[[label]]),
        stroke = 0,
        alpha = 0.9
      )
  }

  plot
}

add_svi_map_equal_circle_layers <- function(plot, symbol_data) {
  for (label in svi_theme_labels) {
    label_points <- symbol_data |>
      filter(svi_theme == label)

    if (nrow(label_points) == 0) {
      next
    }

    plot <- plot +
      geom_sf(
        data = label_points,
        inherit.aes = FALSE,
        shape = unname(svi_cue_alt_shapes[[label]]),
        fill = unname(svi_cue_alt_symbol_fills[[label]]),
        color = unname(svi_cue_alt_symbol_outlines[[label]]),
        size = unname(svi_cue_alt_map_symbol_sizes[[label]]),
        stroke = 0.1,
        alpha = 0.9
      )
  }

  plot
}

add_svi_chart_symbol_layers <- function(plot, symbol_data) {
  for (label in svi_theme_labels) {
    label_points <- symbol_data |>
      filter(svi_theme == label)

    if (nrow(label_points) == 0) {
      next
    }

    plot <- plot +
      geom_point(
        data = label_points,
        aes(x = x, y = svi_theme),
        inherit.aes = FALSE,
        shape = unname(svi_shapes[[label]]),
        fill = unname(svi_symbol_fills[[label]]),
        color = unname(svi_symbol_outlines[[label]]),
        size = unname(svi_chart_symbol_sizes[[label]]),
        stroke = 0,
        alpha = 0.92
      )
  }

  plot
}

add_svi_chart_equal_circle_layers <- function(plot, symbol_data) {
  for (label in svi_theme_labels) {
    label_points <- symbol_data |>
      filter(svi_theme == label)

    if (nrow(label_points) == 0) {
      next
    }

    plot <- plot +
      geom_point(
        data = label_points,
        aes(x = x, y = svi_theme),
        inherit.aes = FALSE,
        shape = unname(svi_cue_alt_shapes[[label]]),
        fill = unname(svi_cue_alt_symbol_fills[[label]]),
        color = unname(svi_cue_alt_symbol_outlines[[label]]),
        size = unname(svi_cue_alt_chart_symbol_sizes[[label]]),
        stroke = 0.1,
        alpha = 0.92
      )
  }

  plot
}

fragile_palette <- c("#1b9e77", "#66a61e", "#e6ab02", "#d95f02", "#7570b3")
names(fragile_palette) <- class_labels

fragile_palette_alt <- c("#66c2a5", "#8da0cb", "#a6d854", "#e78ac3", "#ffd92f")
names(fragile_palette_alt) <- class_labels

robust_palette <- viridisLite::cividis(length(class_labels), direction = -1)
names(robust_palette) <- class_labels

diverging_palette <- c("#2166ac", "#67a9cf", "#d1e5f0", "#fddbc7", "#ef8a62", "#b2182b")
names(diverging_palette) <- deviation_labels

diverging_redesign_palette <- c("#17375e", "#6f86a3", "#d6d9d2", "#eadf9f", "#a2833e", "#553d13")
names(diverging_redesign_palette) <- deviation_labels

diverging_palette_alt <- c("#5e79b8", "#92a4ce", "#d0d6e8", "#e4d6e8", "#c79bc9", "#9259a5")
names(diverging_palette_alt) <- deviation_labels

make_reduced_diverging_palette <- function(palette, labels, source_indices) {
  reduced_palette <- unname(palette[source_indices])
  names(reduced_palette) <- labels
  reduced_palette
}

diverging_simple_palette <- make_reduced_diverging_palette(diverging_palette, deviation_simple_labels, c(1, 3, 4, 6))
diverging_redesign_simple_palette <- make_reduced_diverging_palette(diverging_redesign_palette, deviation_simple_labels, c(1, 3, 4, 6))
diverging_palette_alt_simple <- make_reduced_diverging_palette(diverging_palette_alt, deviation_simple_labels, c(1, 3, 4, 6))

diverging_direction_palette <- make_reduced_diverging_palette(diverging_palette, deviation_direction_labels, c(1, 6))
diverging_redesign_direction_palette <- make_reduced_diverging_palette(diverging_redesign_palette, deviation_direction_labels, c(1, 6))
diverging_palette_alt_direction <- make_reduced_diverging_palette(diverging_palette_alt, deviation_direction_labels, c(1, 6))

svi_fragile_palette <- c("#69b887", "#c9ad4c", "#73aaa8", "#d58b63")
names(svi_fragile_palette) <- svi_theme_labels

svi_robust_palette <- c("#0072b2", "#d55e00", "#009e73", "#cc79a7")
names(svi_robust_palette) <- svi_theme_labels

svi_palette_alt <- c("#8dd3c7", "#bebada", "#fb8072", "#b3de69")
names(svi_palette_alt) <- svi_theme_labels

map_theme <- function(background = "#f8f6ee", text = TRUE) {
  background_fill <- if (isTRUE(is.na(background))) NA else background
  title_color <- if (text) "#151d20" else "transparent"
  subtitle_color <- if (text) "#4c5a5d" else "transparent"
  caption_color <- if (text) "#687375" else "transparent"

  theme_void(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = background_fill, color = NA),
      panel.background = element_rect(fill = background_fill, color = NA),
      plot.title = element_text(color = title_color, face = "bold", size = 22, margin = margin(b = 3)),
      plot.subtitle = element_text(color = subtitle_color, size = 11, margin = margin(b = 12)),
      plot.caption = element_text(color = caption_color, size = 8, hjust = 0, margin = margin(t = 12)),
      legend.position = "none",
      plot.margin = margin(24, 28, 20, 28)
    )
}

chart_theme <- function(background = "#f8f6ee", text = TRUE, grid = TRUE) {
  background_fill <- if (isTRUE(is.na(background))) NA else background
  title_color <- if (text) "#151d20" else "transparent"
  subtitle_color <- if (text) "#4c5a5d" else "transparent"
  caption_color <- if (text) "#687375" else "transparent"
  body_color <- if (text) "#283235" else "transparent"
  grid_color <- if (grid) "#d7ddd7" else "transparent"

  theme_minimal(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = background_fill, color = NA),
      panel.background = element_rect(fill = background_fill, color = NA),
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank(),
      panel.grid.major.x = element_line(color = grid_color, linewidth = 0.35),
      axis.title = element_text(color = body_color, face = "bold", size = 9),
      axis.text = element_text(color = body_color, size = 9),
      plot.title = element_text(color = title_color, face = "bold", size = 22, margin = margin(b = 3)),
      plot.subtitle = element_text(color = subtitle_color, size = 11, margin = margin(b = 12)),
      plot.caption = element_text(color = caption_color, size = 8, hjust = 0, margin = margin(t = 12)),
      legend.position = "bottom",
      legend.title = element_text(color = title_color, face = "bold", size = 9),
      legend.text = element_text(color = body_color, size = 8),
      plot.margin = margin(24, 34, 20, 26)
    )
}

source_caption <- paste(
  "Source: CDC PLACES County Data GIS-Friendly Format, 2025 release;",
  "diagnosed diabetes crude prevalence among adults."
)

transfer_caption <- paste(
  "Source: CDC PLACES County Data GIS-Friendly Format, 2025 release;",
  "Texas county model-based estimates."
)

average_caption <- sprintf(
  "Estimated Texas average: %.1f%% (county population-weighted).",
  texas_average
)

svi_caption <- paste(
  "Source: CDC/ATSDR Social Vulnerability Index 2022 Texas county data;",
  "highest-ranked theme among four SVI theme percentile rankings."
)

map_legend_grob <- function(
  title,
  labels,
  palette,
  stipple_labels = character(),
  symbol_shapes = NULL,
  symbol_fills = NULL,
  symbol_outlines = NULL,
  symbol_sizes = NULL,
  symbol_counts = NULL,
  draw_swatch_fills = TRUE,
  draw_swatch_borders = TRUE,
  draw_text = TRUE,
  draw_cues = TRUE,
  draw_divider = FALSE,
  divider_after = NULL,
  divider_label = NULL,
  divider_side_labels = FALSE,
  divider_top_label = "Above Texas avg.",
  divider_bottom_label = "Below Texas avg."
) {
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
    )
  )

  if (draw_text) {
    grobs <- append(grobs, list(
      textGrob(
        title,
        x = x + padding_x,
        y = y - padding_top,
        just = c("left", "top"),
        gp = gpar(col = "#151d20", fontsize = 9 * legend_scale, fontface = "bold", fontfamily = "Arial")
      )
    ))
  }

  key_left <- x + padding_x
  key_width <- unit(0.034 * legend_scale, "npc")
  key_height <- unit(0.017 * legend_scale, "npc")
  label_x <- key_left + key_width + unit(0.01 * legend_scale, "npc")

  for (index in seq_along(labels)) {
    label <- labels[[index]]
    row_y <- y - padding_top - title_height - row_height * (index - 0.5)
    fill <- if (draw_swatch_fills) unname(palette[[label]]) else NA
    border <- if (draw_swatch_borders) "#d4d9d3" else NA

    grobs <- append(grobs, list(
      rectGrob(
        x = key_left,
        y = row_y,
        width = key_width,
        height = key_height,
        just = c("left", "center"),
        gp = gpar(fill = fill, col = border, lwd = 0.6)
      )
    ))

    if (draw_cues && label %in% stipple_labels) {
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

    if (draw_cues && !is.null(symbol_shapes) && label %in% names(symbol_shapes)) {
      symbol_count <- if (!is.null(symbol_counts) && label %in% names(symbol_counts)) {
        unname(symbol_counts[[label]])
      } else {
        1
      }
      symbol_x_offsets <- switch(
        as.character(symbol_count),
        "1" = 0.5,
        "2" = c(0.36, 0.64),
        "3" = c(0.27, 0.5, 0.73),
        c(0.32, 0.68, 0.32, 0.68)
      )
      symbol_y_offsets <- switch(
        as.character(symbol_count),
        "1" = 0,
        "2" = c(0, 0),
        "3" = c(0, 0, 0),
        c(0.004, 0.004, -0.004, -0.004)
      )
      symbol_fill <- if (!is.null(symbol_fills) && label %in% names(symbol_fills)) {
        unname(symbol_fills[[label]])
      } else {
        "#151d20"
      }
      symbol_outline <- if (!is.null(symbol_outlines) && label %in% names(symbol_outlines)) {
        unname(symbol_outlines[[label]])
      } else {
        "#f8f6ee"
      }
      symbol_size <- if (!is.null(symbol_sizes) && label %in% names(symbol_sizes)) {
        unname(symbol_sizes[[label]])
      } else {
        1.4
      }

      grobs <- append(grobs, list(
        pointsGrob(
          x = key_left + key_width * symbol_x_offsets,
          y = row_y + unit(symbol_y_offsets * legend_scale, "npc"),
          pch = unname(symbol_shapes[[label]]),
          size = unit(symbol_size * legend_scale, "mm"),
          gp = gpar(col = symbol_outline, fill = symbol_fill, alpha = 0.9, lwd = 0)
        )
      ))
    }

    if (draw_text) {
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
  }

  if (isTRUE(draw_divider) && !is.null(divider_after)) {
    divider_y <- y - padding_top - title_height - row_height * divider_after
    divider_x0 <- x + padding_x
    divider_x1 <- x + width - padding_x
    grobs <- append(grobs, list(
      segmentsGrob(
        x0 = divider_x0,
        x1 = divider_x1,
        y0 = divider_y,
        y1 = divider_y,
        gp = gpar(col = "#151d20", lwd = 3.2, lineend = "round")
      )
    ))
    if (!is.null(divider_label)) {
      grobs <- append(grobs, list(
        textGrob(
          divider_label,
          x = divider_x1,
          y = divider_y + unit(0.003 * legend_scale, "npc"),
          just = c("right", "bottom"),
          gp = gpar(col = "#151d20", fontsize = 6.6 * legend_scale, fontface = "bold", fontfamily = "Arial")
        )
      ))
    }
    if (isTRUE(divider_side_labels)) {
      grobs <- append(grobs, list(
        textGrob(
          divider_top_label,
          x = divider_x1,
          y = divider_y + unit(0.010 * legend_scale, "npc"),
          just = c("right", "bottom"),
          gp = gpar(col = "#151d20", fontsize = 6.4 * legend_scale, fontface = "bold", fontfamily = "Arial")
        ),
        textGrob(
          divider_bottom_label,
          x = divider_x1,
          y = divider_y - unit(0.004 * legend_scale, "npc"),
          just = c("right", "top"),
          gp = gpar(col = "#151d20", fontsize = 6.4 * legend_scale, fontface = "bold", fontfamily = "Arial")
        )
      ))
    }
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

save_png <- function(plot, filename, legend = NULL, background = "#f8f6ee") {
  path <- file.path(output_dir, filename)
  ragg::agg_png(path, width = 1400, height = 980, units = "px", res = 144, background = background)
  print(plot)
  if (!is.null(legend)) {
    grid.draw(legend)
  }
  dev.off()
  message("Wrote ", normalizePath(path))
}

add_map_extent_anchor <- function(plot, visible = FALSE) {
  plot +
    geom_sf(
      data = map_neatline,
      inherit.aes = FALSE,
      fill = NA,
      color = if (visible) "#f8f6ee" else NA,
      linewidth = if (visible) 0.18 else 0
    )
}

map_color_layer <- function(fill_column, palette, title, subtitle, caption, map_data = tx_map, close_seams = FALSE) {
  fill_layer <- if (isTRUE(close_seams)) {
    geom_sf(aes(fill = .data[[fill_column]], color = .data[[fill_column]]), linewidth = 0.32)
  } else {
    geom_sf(aes(fill = .data[[fill_column]]), color = NA, linewidth = 0)
  }

  plot <- ggplot(map_data) +
    geom_sf(data = map_neatline, inherit.aes = FALSE, fill = NA, color = NA, linewidth = 0) +
    fill_layer

  plot <- plot +
    scale_fill_manual(
      values = palette,
      drop = FALSE,
      na.translate = FALSE,
      na.value = "#d8d8cf",
      guide = "none"
    )

  if (isTRUE(close_seams)) {
    plot <- plot +
      scale_color_manual(
        values = palette,
        drop = FALSE,
        na.translate = FALSE,
        na.value = "#d8d8cf",
        guide = "none"
      )
  }

  plot +
    labs(title = title, subtitle = subtitle, caption = caption) +
    map_theme(text = FALSE)
}

map_structure_layer <- function(title, subtitle, caption) {
  add_map_extent_anchor(ggplot(tx_map), visible = TRUE) +
    geom_sf(fill = NA, color = "#ffffff", linewidth = 0.12) +
    geom_sf(data = tx_outline, inherit.aes = FALSE, fill = NA, color = "#1b2427", linewidth = 0.35) +
    labs(title = title, subtitle = subtitle, caption = caption) +
    map_theme(background = NA, text = TRUE)
}

map_structure_no_boundary_layer <- function(title, subtitle, caption) {
  add_map_extent_anchor(ggplot(tx_map), visible = TRUE) +
    geom_sf(data = tx_outline, inherit.aes = FALSE, fill = NA, color = "#1b2427", linewidth = 0.35) +
    labs(title = title, subtitle = subtitle, caption = caption) +
    map_theme(background = NA, text = TRUE)
}

map_boundary_cue_layer <- function(title, subtitle, caption) {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf(fill = NA, color = "#151d20", linewidth = 0.18) +
    geom_sf(data = tx_outline, inherit.aes = FALSE, fill = NA, color = "#151d20", linewidth = 0.46) +
    labs(title = title, subtitle = subtitle, caption = caption) +
    map_theme(background = NA, text = FALSE)
}

map_layer_legend_colors <- function(title, labels, palette) {
  map_legend_grob(
    title,
    labels,
    palette,
    draw_swatch_fills = TRUE,
    draw_swatch_borders = FALSE,
    draw_text = FALSE,
    draw_cues = FALSE
  )
}

map_layer_legend_structure <- function(title, labels, palette) {
  map_legend_grob(
    title,
    labels,
    palette,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = TRUE,
    draw_text = TRUE,
    draw_cues = FALSE
  )
}

map_layer_legend_text <- function(title, labels, palette) {
  map_legend_grob(
    title,
    labels,
    palette,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = FALSE,
    draw_text = TRUE,
    draw_cues = FALSE
  )
}

map_layer_legend_cues <- function(title, labels, palette, ...) {
  map_legend_grob(
    title,
    labels,
    palette,
    ...,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = FALSE,
    draw_text = FALSE,
    draw_cues = TRUE
  )
}

map_layer_legend_divider <- function(title, labels, palette) {
  map_legend_grob(
    title,
    labels,
    palette,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = FALSE,
    draw_text = FALSE,
    draw_cues = FALSE,
    draw_divider = TRUE,
    divider_after = 3,
    divider_label = "Texas avg."
  )
}

map_layer_legend_labeled_midpoint <- function(title, labels, palette) {
  map_legend_grob(
    title,
    labels,
    palette,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = FALSE,
    draw_text = FALSE,
    draw_cues = FALSE,
    draw_divider = TRUE,
    divider_after = 3,
    divider_side_labels = TRUE
  )
}

map_layer_legend_two_sided_cues <- function(title, labels, palette, above_labels, below_labels) {
  below_shapes <- setNames(rep(21, length(below_labels)), below_labels)
  below_fills <- setNames(rep("#f8f6ee", length(below_labels)), below_labels)
  below_outlines <- setNames(rep("#151d20", length(below_labels)), below_labels)
  below_sizes <- setNames(rep(0.72, length(below_labels)), below_labels)
  below_counts <- setNames(rep(3, length(below_labels)), below_labels)

  map_legend_grob(
    title,
    labels,
    palette,
    stipple_labels = above_labels,
    symbol_shapes = below_shapes,
    symbol_fills = below_fills,
    symbol_outlines = below_outlines,
    symbol_sizes = below_sizes,
    symbol_counts = below_counts,
    draw_swatch_fills = FALSE,
    draw_swatch_borders = FALSE,
    draw_text = FALSE,
    draw_cues = TRUE
  )
}

format_percent_label <- function(value) {
  sprintf("%.1f%%", value)
}

make_percent_class_labels <- function(breaks) {
  paste0(
    format_percent_label(head(breaks, -1)),
    "-",
    format_percent_label(tail(breaks, -1))
  )
}

make_quantile_breaks <- function(values, groups) {
  breaks <- values |>
    quantile(probs = seq(0, 1, length.out = groups + 1), na.rm = TRUE, names = FALSE) |>
    round(1) |>
    unique()

  if (length(breaks) < groups + 1) {
    breaks <- pretty(values, n = groups) |>
      round(1) |>
      unique()
  }

  breaks
}

transfer_map_theme <- function(background = "#f8f6ee") {
  theme_void(base_family = "Arial") +
    theme(
      plot.background = element_rect(fill = background, color = NA),
      panel.background = element_rect(fill = background, color = NA),
      plot.title = element_text(color = "#151d20", face = "bold", size = 26, margin = margin(b = 3)),
      plot.subtitle = element_text(color = "#4c5a5d", size = 12, margin = margin(b = 9)),
      plot.caption = element_text(color = "#687375", size = 8, hjust = 0, margin = margin(t = 9)),
      legend.position = c(0.01, 0.92),
      legend.justification = c(0, 1),
      legend.direction = "vertical",
      legend.background = element_rect(fill = background, color = NA),
      legend.title = element_text(color = "#151d20", face = "bold", size = 11),
      legend.text = element_text(color = "#283235", size = 10),
      legend.key.height = unit(16, "pt"),
      legend.key.width = unit(30, "pt"),
      legend.spacing.y = unit(3, "pt"),
      plot.margin = margin(18, 24, 16, 24)
    )
}

transfer_map_plot <- function(fill_column, palette, title, subtitle, caption, map_data, legend_title) {
  add_map_extent_anchor(ggplot(map_data), visible = TRUE) +
    geom_sf(aes(fill = .data[[fill_column]]), color = "#f8f6ee", linewidth = 0.08) +
    geom_sf(data = tx_outline, inherit.aes = FALSE, fill = NA, color = "#1b2427", linewidth = 0.32) +
    scale_fill_manual(
      values = palette,
      drop = FALSE,
      na.translate = FALSE,
      na.value = "#d8d8cf",
      name = legend_title
    ) +
    guides(fill = guide_legend(reverse = TRUE, override.aes = list(color = NA))) +
    labs(title = title, subtitle = subtitle, caption = caption) +
    transfer_map_theme()
}

make_transfer_quantile_map <- function(spec) {
  values <- tx_map[[spec$column]]
  breaks <- make_quantile_breaks(values, spec$groups)
  labels <- make_percent_class_labels(breaks)
  palette <- setNames(spec$palette[seq_along(labels)], labels)
  map_data <- tx_map |>
    mutate(transfer_class = cut(
      .data[[spec$column]],
      breaks = breaks,
      labels = labels,
      include.lowest = TRUE
    ))

  list(
    plot = transfer_map_plot(
      "transfer_class",
      palette,
      spec$title,
      spec$subtitle,
      transfer_caption,
      map_data,
      spec$legend_title
    ),
    legend = NULL
  )
}

make_transfer_diverging_map <- function(spec) {
  values <- tx_map[[spec$column]]
  average <- weighted.mean(values, tx_map$transfer_population, na.rm = TRUE)
  labels <- deviation_labels
  palette <- setNames(spec$palette[seq_along(labels)], labels)
  map_data <- tx_map |>
    mutate(
      transfer_difference = .data[[spec$column]] - average,
      transfer_class = cut(
        transfer_difference,
        breaks = deviation_breaks,
        labels = labels,
        include.lowest = TRUE,
        right = FALSE
      )
    )

  list(
    plot = transfer_map_plot(
      "transfer_class",
      palette,
      spec$title,
      spec$subtitle,
      transfer_caption,
      map_data,
      spec$legend_title
    ),
    legend = NULL
  )
}

make_transfer_challenge_map <- function(spec) {
  if (identical(spec$type, "diverging")) {
    return(make_transfer_diverging_map(spec))
  }

  make_transfer_quantile_map(spec)
}

transfer_map_specs <- list(
  list(
    id = "obesity-sequential-rainbow",
    column = "obesity",
    type = "quantile",
    groups = 5,
    title = "Adult Obesity Prevalence by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "Adult obesity",
    palette = c("#4575b4", "#91bfdb", "#ffffbf", "#fc8d59", "#d73027")
  ),
  list(
    id = "inactivity-diverging-redgreen",
    column = "inactivity",
    type = "diverging",
    title = "Physical Inactivity Relative to Texas Average",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "Difference",
    palette = c("#1a9850", "#91cf60", "#d9ef8b", "#fee08b", "#fc8d59", "#d73027")
  ),
  list(
    id = "smoking-too-many-classes",
    column = "smoking",
    type = "quantile",
    groups = 8,
    title = "Current Smoking Prevalence by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "Current smoking",
    palette = c("#4dac26", "#b8e186", "#f7f7f7", "#f1b6da", "#d01c8b", "#67a9cf", "#ef8a62", "#762a83")
  ),
  list(
    id = "depression-low-contrast",
    column = "depression",
    type = "quantile",
    groups = 5,
    title = "Depression Prevalence by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "Depression",
    palette = c("#d6d9d2", "#cfd4cf", "#c7d0cc", "#c0cbc9", "#b9c6c5")
  ),
  list(
    id = "blood-pressure-legend-load",
    column = "blood_pressure",
    type = "quantile",
    groups = 5,
    title = "High Blood Pressure Prevalence by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "High blood pressure",
    palette = c("#7fbf9b", "#76b99e", "#6eb2a1", "#66aba4", "#5da5a7")
  ),
  list(
    id = "insurance-categorical-mismatch",
    column = "uninsured",
    type = "quantile",
    groups = 5,
    title = "Lack of Health Insurance by County",
    subtitle = "Texas counties, CDC PLACES 2025 release",
    legend_title = "No insurance",
    palette = c("#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854")
  )
)

prevalence_chart_scale <- function() {
  scale_x_continuous(
    limits = c(0, max(class_summary$county_count) * 1.32),
    expand = expansion(mult = 0)
  )
}

svi_chart_scale <- function() {
  scale_x_continuous(
    limits = c(0, max(svi_summary$county_count) * 1.32),
    expand = expansion(mult = 0)
  )
}

diverging_chart_x_scale <- function(summary_data = difference_summary, multiplier = 1.42) {
  scale_x_continuous(
    labels = abs,
    limits = max(abs(summary_data$signed_count)) * c(-multiplier, multiplier),
    expand = expansion(mult = 0)
  )
}

diverging_chart_y_scale <- function(labels = deviation_labels) {
  scale_y_continuous(
    breaks = seq_along(labels),
    labels = labels,
    expand = expansion(add = 0.45)
  )
}

chart_color_theme <- function() {
  chart_theme(text = FALSE, grid = FALSE)
}

chart_overlay_theme <- function(text = FALSE, grid = FALSE) {
  chart_theme(background = NA, text = text, grid = grid)
}

make_prevalence_chart_color_layer <- function(palette = FALSE) {
  fill_palette <- if (identical(palette, "alt") || identical(palette, "paletteAlt")) {
    fragile_palette_alt
  } else if (isTRUE(palette)) {
    robust_palette
  } else {
    fragile_palette
  }

  ggplot(class_summary, aes(x = county_count, y = diabetes_class, fill = diabetes_class)) +
    geom_col(width = 0.72) +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    prevalence_chart_scale() +
    labs(
      title = "County Count by Diabetes Prevalence Class",
      subtitle = "Same Texas county classes and colors as the map",
      x = "Number of counties",
      y = "Crude prevalence among adults",
      caption = source_caption
    ) +
    chart_color_theme()
}

make_prevalence_chart_structure_layer <- function() {
  ggplot(class_summary, aes(x = county_count, y = diabetes_class)) +
    geom_blank() +
    prevalence_chart_scale() +
    labs(
      title = "County Count by Diabetes Prevalence Class",
      subtitle = "Same Texas county classes and colors as the map",
      x = "Number of counties",
      y = "Crude prevalence among adults",
      caption = source_caption
    ) +
    chart_overlay_theme(text = TRUE, grid = TRUE)
}

make_prevalence_chart_cue_layer <- function() {
  ggplot(class_summary, aes(x = county_count, y = diabetes_class)) +
    geom_col(width = 0.72, fill = NA, color = "#151d20", linewidth = 0.18) +
    prevalence_chart_scale() +
    labs(
      title = "County Count by Diabetes Prevalence Class",
      subtitle = "Same Texas county classes and colors as the map",
      x = "Number of counties",
      y = "Crude prevalence among adults",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_prevalence_chart_label_layer <- function() {
  ggplot(class_summary, aes(x = county_count, y = diabetes_class)) +
    geom_text(
      aes(label = label),
      hjust = -0.05,
      color = "#151d20",
      family = "Arial",
      fontface = "bold",
      size = 3.2
    ) +
    prevalence_chart_scale() +
    labs(
      title = "County Count by Diabetes Prevalence Class",
      subtitle = "Same Texas county classes and colors as the map",
      x = "Number of counties",
      y = "Crude prevalence among adults",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

diverging_palette_for_variant <- function(palette = FALSE, variant = "detailed") {
  if (identical(variant, "simple")) {
    if (identical(palette, "alt") || identical(palette, "paletteAlt")) return(diverging_palette_alt_simple)
    if (isTRUE(palette)) return(diverging_redesign_simple_palette)
    return(diverging_simple_palette)
  }

  if (identical(variant, "direction")) {
    if (identical(palette, "alt") || identical(palette, "paletteAlt")) return(diverging_palette_alt_direction)
    if (isTRUE(palette)) return(diverging_redesign_direction_palette)
    return(diverging_direction_palette)
  }

  if (identical(palette, "alt") || identical(palette, "paletteAlt")) return(diverging_palette_alt)
  if (isTRUE(palette)) return(diverging_redesign_palette)
  diverging_palette
}

make_diverging_chart_color_layer <- function(
  palette = FALSE,
  summary_data = difference_summary,
  labels = deviation_labels,
  variant = "detailed"
) {
  fill_palette <- diverging_palette_for_variant(palette, variant)

  ggplot(summary_data) +
    geom_rect(
      aes(
        xmin = xmin,
        xmax = xmax,
        ymin = ymin,
        ymax = ymax,
        fill = diabetes_difference_class
      )
    ) +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    diverging_chart_x_scale(summary_data) +
    diverging_chart_y_scale(labels) +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_color_theme()
}

make_diverging_chart_structure_layer <- function(summary_data = difference_summary, labels = deviation_labels) {
  ggplot(summary_data) +
    geom_vline(xintercept = 0, color = "#151d20", linewidth = 0.42) +
    geom_blank(aes(x = signed_count, y = y_index)) +
    diverging_chart_x_scale(summary_data) +
    diverging_chart_y_scale(labels) +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme(text = TRUE, grid = TRUE)
}

make_diverging_chart_cue_layer <- function(
  summary_data = difference_summary,
  labels = deviation_labels,
  hatches = difference_bar_hatches
) {
  ggplot(summary_data) +
    geom_rect(
      aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax),
      fill = NA,
      color = "#151d20",
      linewidth = 0.18
    ) +
    geom_segment(
      data = hatches,
      aes(x = x, xend = xend, y = y, yend = yend),
      inherit.aes = FALSE,
      color = "#151d20",
      linewidth = 0.34,
      alpha = 0.68
    ) +
    diverging_chart_x_scale(summary_data) +
    diverging_chart_y_scale(labels) +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_diverging_chart_cue_alt_layer <- function(
  summary_data = difference_summary,
  labels = deviation_labels,
  hatches = difference_bar_hatches,
  below_points = difference_bar_below_points
) {
  ggplot(summary_data) +
    geom_rect(
      aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax),
      fill = NA,
      color = "#151d20",
      linewidth = 0.18
    ) +
    geom_point(
      data = below_points,
      aes(x = x, y = y),
      inherit.aes = FALSE,
      shape = 21,
      fill = "#f8f6ee",
      color = "#151d20",
      size = 1.25,
      stroke = 0.18,
      alpha = 0.78
    ) +
    geom_segment(
      data = hatches,
      aes(x = x, xend = xend, y = y, yend = yend),
      inherit.aes = FALSE,
      color = "#151d20",
      linewidth = 0.34,
      alpha = 0.68
    ) +
    diverging_chart_x_scale(summary_data) +
    diverging_chart_y_scale(labels) +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_diverging_chart_label_layer <- function() {
  ggplot(difference_summary) +
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
    diverging_chart_x_scale() +
    diverging_chart_y_scale() +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_diverging_chart_annotation_layer <- function() {
  ggplot(difference_summary) +
    geom_vline(xintercept = 0, color = "#151d20", linewidth = 1.05) +
    annotate(
      "label",
      x = 0,
      y = length(deviation_labels) + 0.34,
      label = "Texas average",
      family = "Arial",
      fontface = "bold",
      size = 3.1,
      label.padding = unit(0.14, "lines"),
      linewidth = 0.28,
      fill = "#f8f6ee",
      color = "#151d20"
    ) +
    diverging_chart_x_scale() +
    diverging_chart_y_scale() +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_diverging_chart_reference_labeled_layer <- function() {
  label_x <- max(abs(difference_summary$signed_count)) * 0.52

  ggplot(difference_summary) +
    geom_vline(xintercept = 0, color = "#151d20", linewidth = 1.05) +
    annotate(
      "label",
      x = -label_x,
      y = length(deviation_labels) + 0.34,
      label = "Below Texas avg.",
      family = "Arial",
      fontface = "bold",
      size = 3.05,
      label.padding = unit(0.14, "lines"),
      linewidth = 0.28,
      fill = "#f8f6ee",
      color = "#151d20"
    ) +
    annotate(
      "label",
      x = label_x,
      y = length(deviation_labels) + 0.34,
      label = "Above Texas avg.",
      family = "Arial",
      fontface = "bold",
      size = 3.05,
      label.padding = unit(0.14, "lines"),
      linewidth = 0.28,
      fill = "#f8f6ee",
      color = "#151d20"
    ) +
    diverging_chart_x_scale() +
    diverging_chart_y_scale() +
    labs(
      title = "County Count Above and Below Texas Average",
      subtitle = "Same diverging classes and colors as the map",
      x = "Number of counties",
      y = "Difference from Texas average",
      caption = source_caption
    ) +
    chart_overlay_theme()
}

make_svi_chart_color_layer <- function(palette = FALSE) {
  fill_palette <- if (identical(palette, "alt") || identical(palette, "paletteAlt")) {
    svi_palette_alt
  } else if (isTRUE(palette)) {
    svi_robust_palette
  } else {
    svi_fragile_palette
  }

  ggplot(svi_summary, aes(x = county_count, y = svi_theme, fill = svi_theme)) +
    geom_col(width = 0.72) +
    scale_fill_manual(values = fill_palette, drop = FALSE, guide = "none") +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    svi_chart_scale() +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = "Same SVI theme categories and colors as the map",
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_color_theme()
}

make_svi_chart_structure_layer <- function() {
  ggplot(svi_summary, aes(x = county_count, y = svi_theme)) +
    geom_blank() +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    svi_chart_scale() +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = "Same SVI theme categories and colors as the map",
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_overlay_theme(text = TRUE, grid = TRUE)
}

make_svi_chart_cue_layer <- function() {
  plot <- ggplot(svi_summary, aes(x = county_count, y = svi_theme)) +
    geom_col(width = 0.72, fill = NA, color = "#151d20", linewidth = 0.18)

  plot <- add_svi_chart_symbol_layers(plot, svi_chart_symbols)

  plot +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    svi_chart_scale() +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = "Same SVI theme categories and colors as the map",
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_overlay_theme()
}

make_svi_chart_cue_alt_layer <- function() {
  plot <- ggplot(svi_summary, aes(x = county_count, y = svi_theme)) +
    geom_col(width = 0.72, fill = NA, color = "#151d20", linewidth = 0.18)

  plot <- add_svi_chart_equal_circle_layers(plot, svi_chart_symbols_alt)

  plot +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    svi_chart_scale() +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = "Same SVI theme categories and colors as the map",
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_overlay_theme()
}

make_svi_chart_label_layer <- function() {
  ggplot(svi_summary, aes(x = county_count, y = svi_theme)) +
    geom_text(
      aes(label = label),
      hjust = -0.05,
      color = "#151d20",
      family = "Arial",
      fontface = "bold",
      size = 3.2
    ) +
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    svi_chart_scale() +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = "Same SVI theme categories and colors as the map",
      x = "Number of counties",
      y = "SVI theme",
      caption = svi_caption
    ) +
    chart_overlay_theme()
}

make_prevalence_map_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
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
    labs(
      title = "Diagnosed Diabetes Prevalence by County",
      subtitle = "Texas counties, CDC PLACES 2025 release",
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_prevalence_map_all_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf_text(
      data = all_county_labels,
      aes(label = label),
      family = "Arial",
      size = 1.35,
      fontface = "bold",
      color = "#151d20",
      check_overlap = FALSE
    ) +
    labs(
      title = "Diagnosed Diabetes Prevalence by County",
      subtitle = "Texas counties, CDC PLACES 2025 release",
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_diverging_map_cue_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf(data = above_stipple, inherit.aes = FALSE, color = "#151d20", size = 0.18, alpha = 0.5) +
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = average_caption,
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_diverging_map_cue_alt_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf(
      data = below_stipple,
      inherit.aes = FALSE,
      shape = 21,
      fill = "#f8f6ee",
      color = "#151d20",
      size = 0.34,
      stroke = 0.08,
      alpha = 0.74
    ) +
    geom_sf(data = above_stipple, inherit.aes = FALSE, color = "#151d20", size = 0.18, alpha = 0.5) +
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = average_caption,
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_diverging_map_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
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
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = average_caption,
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_diverging_map_all_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf_text(
      data = all_difference_labels,
      aes(label = label),
      family = "Arial",
      size = 1.35,
      fontface = "bold",
      color = "#151d20",
      check_overlap = FALSE
    ) +
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = average_caption,
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_diverging_map_annotation_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    labs(
      title = "Diagnosed Diabetes Relative to Texas Average",
      subtitle = average_caption,
      caption = source_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_svi_map_cue_layer <- function() {
  plot <- add_map_extent_anchor(ggplot(tx_map)) +
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = "Texas counties, CDC/ATSDR SVI 2022",
      caption = svi_caption
    ) +
    map_theme(background = NA, text = FALSE)

  add_svi_map_symbol_layers(plot, svi_symbol_points)
}

make_svi_map_cue_alt_layer <- function() {
  plot <- add_map_extent_anchor(ggplot(tx_map)) +
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = "Texas counties, CDC/ATSDR SVI 2022",
      caption = svi_caption
    ) +
    map_theme(background = NA, text = FALSE)

  add_svi_map_equal_circle_layers(plot, svi_symbol_points_alt)
}

make_svi_map_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
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
    ) +
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = "Texas counties, CDC/ATSDR SVI 2022",
      caption = svi_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

make_svi_map_all_label_layer <- function() {
  add_map_extent_anchor(ggplot(tx_map)) +
    geom_sf_text(
      data = all_svi_labels,
      aes(label = label),
      family = "Arial",
      size = 1.95,
      fontface = "bold",
      color = "#151d20",
      alpha = 0.8
    ) +
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = "Texas counties, CDC/ATSDR SVI 2022",
      caption = svi_caption
    ) +
    map_theme(background = NA, text = FALSE)
}

save_layer_assets <- function() {
  transparent <- "transparent"
  reversed_class_labels <- rev(class_labels)
  reversed_deviation_labels <- rev(deviation_labels)
  reversed_svi_labels <- rev(svi_theme_labels)
  above_labels <- reversed_deviation_labels[grepl("above", reversed_deviation_labels)]
  below_labels <- reversed_deviation_labels[grepl("below", reversed_deviation_labels)]

  save_png(
    map_color_layer(
      "diabetes_class",
      fragile_palette,
      "Diagnosed Diabetes Prevalence by County",
      "Texas counties, CDC PLACES 2025 release",
      source_caption,
      close_seams = TRUE
    ),
    "cdc-places-diabetes-map-layer-color-p0.png",
    legend = map_layer_legend_colors("Diagnosed diabetes", reversed_class_labels, fragile_palette)
  )
  save_png(
    map_color_layer(
      "diabetes_class",
      robust_palette,
      "Diagnosed Diabetes Prevalence by County",
      "Texas counties, CDC PLACES 2025 release",
      source_caption,
      close_seams = TRUE
    ),
    "cdc-places-diabetes-map-layer-color-p1.png",
    legend = map_layer_legend_colors("Diagnosed diabetes", reversed_class_labels, robust_palette)
  )
  save_png(
    map_color_layer(
      "diabetes_class",
      fragile_palette_alt,
      "Diagnosed Diabetes Prevalence by County",
      "Texas counties, CDC PLACES 2025 release",
      source_caption,
      close_seams = TRUE
    ),
    "cdc-places-diabetes-map-layer-color-p2.png",
    legend = map_layer_legend_colors("Diagnosed diabetes", reversed_class_labels, fragile_palette_alt)
  )
  save_png(
    map_structure_layer("Diagnosed Diabetes Prevalence by County", "Texas counties, CDC PLACES 2025 release", source_caption),
    "cdc-places-diabetes-map-layer-structure.png",
    legend = map_layer_legend_structure("Diagnosed diabetes", reversed_class_labels, fragile_palette),
    background = transparent
  )
  save_png(
    map_structure_no_boundary_layer("Diagnosed Diabetes Prevalence by County", "Texas counties, CDC PLACES 2025 release", source_caption),
    "cdc-places-diabetes-map-layer-structure-no-boundaries.png",
    legend = map_layer_legend_text("Diagnosed diabetes", reversed_class_labels, fragile_palette),
    background = transparent
  )
  save_png(
    map_boundary_cue_layer("Diagnosed Diabetes Prevalence by County", "Texas counties, CDC PLACES 2025 release", source_caption),
    "cdc-places-diabetes-map-layer-cue.png",
    background = transparent
  )
  save_png(make_prevalence_map_label_layer(), "cdc-places-diabetes-map-layer-labels.png", background = transparent)
  save_png(make_prevalence_map_all_label_layer(), "cdc-places-diabetes-map-layer-all-labels.png", background = transparent)
  save_png(make_prevalence_chart_color_layer(FALSE), "cdc-places-diabetes-chart-layer-color-p0.png")
  save_png(make_prevalence_chart_color_layer(TRUE), "cdc-places-diabetes-chart-layer-color-p1.png")
  save_png(make_prevalence_chart_color_layer("alt"), "cdc-places-diabetes-chart-layer-color-p2.png")
  save_png(make_prevalence_chart_structure_layer(), "cdc-places-diabetes-chart-layer-structure.png", background = transparent)
  save_png(make_prevalence_chart_cue_layer(), "cdc-places-diabetes-chart-layer-cue.png", background = transparent)
  save_png(make_prevalence_chart_label_layer(), "cdc-places-diabetes-chart-layer-labels.png", background = transparent)

  save_png(
    map_color_layer("diabetes_difference_class", diverging_palette, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
    "cdc-places-diabetes-diverging-map-layer-color-p0.png",
    legend = map_layer_legend_colors("Difference", reversed_deviation_labels, diverging_palette)
  )
  save_png(
    map_color_layer("diabetes_difference_class", diverging_redesign_palette, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
    "cdc-places-diabetes-diverging-map-layer-color-p1.png",
    legend = map_layer_legend_colors("Difference", reversed_deviation_labels, diverging_redesign_palette)
  )
  save_png(
    map_color_layer("diabetes_difference_class", diverging_palette_alt, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
    "cdc-places-diabetes-diverging-map-layer-color-p2.png",
    legend = map_layer_legend_colors("Difference", reversed_deviation_labels, diverging_palette_alt)
  )
  save_png(
    map_structure_layer("Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
    "cdc-places-diabetes-diverging-map-layer-structure.png",
    legend = map_layer_legend_structure("Difference", reversed_deviation_labels, diverging_palette),
    background = transparent
  )
  save_png(
    make_diverging_map_cue_layer(),
    "cdc-places-diabetes-diverging-map-layer-cue.png",
    legend = map_layer_legend_cues("Difference", reversed_deviation_labels, diverging_palette, stipple_labels = above_labels),
    background = transparent
  )
  save_png(
    make_diverging_map_cue_alt_layer(),
    "cdc-places-diabetes-diverging-map-layer-cue-alt.png",
    legend = map_layer_legend_two_sided_cues(
      "Difference",
      reversed_deviation_labels,
      diverging_palette,
      above_labels,
      below_labels
    ),
    background = transparent
  )
  save_png(make_diverging_map_label_layer(), "cdc-places-diabetes-diverging-map-layer-labels.png", background = transparent)
  save_png(make_diverging_map_all_label_layer(), "cdc-places-diabetes-diverging-map-layer-all-labels.png", background = transparent)
  save_png(
    make_diverging_map_annotation_layer(),
    "cdc-places-diabetes-diverging-map-layer-annotation.png",
    legend = map_layer_legend_divider("Difference", reversed_deviation_labels, diverging_palette),
    background = transparent
  )
  save_png(
    make_diverging_map_annotation_layer(),
    "cdc-places-diabetes-diverging-map-layer-reference-divider.png",
    legend = map_layer_legend_divider("Difference", reversed_deviation_labels, diverging_palette),
    background = transparent
  )
  save_png(
    make_diverging_map_annotation_layer(),
    "cdc-places-diabetes-diverging-map-layer-reference-labeled.png",
    legend = map_layer_legend_labeled_midpoint("Difference", reversed_deviation_labels, diverging_palette),
    background = transparent
  )
  save_png(make_diverging_chart_color_layer(FALSE), "cdc-places-diabetes-diverging-chart-layer-color-p0.png")
  save_png(make_diverging_chart_color_layer(TRUE), "cdc-places-diabetes-diverging-chart-layer-color-p1.png")
  save_png(make_diverging_chart_color_layer("alt"), "cdc-places-diabetes-diverging-chart-layer-color-p2.png")
  save_png(make_diverging_chart_structure_layer(), "cdc-places-diabetes-diverging-chart-layer-structure.png", background = transparent)
  save_png(make_diverging_chart_cue_layer(), "cdc-places-diabetes-diverging-chart-layer-cue.png", background = transparent)
  save_png(make_diverging_chart_cue_alt_layer(), "cdc-places-diabetes-diverging-chart-layer-cue-alt.png", background = transparent)
  save_png(make_diverging_chart_label_layer(), "cdc-places-diabetes-diverging-chart-layer-labels.png", background = transparent)
  save_png(make_diverging_chart_annotation_layer(), "cdc-places-diabetes-diverging-chart-layer-annotation.png", background = transparent)
  save_png(make_diverging_chart_annotation_layer(), "cdc-places-diabetes-diverging-chart-layer-reference-divider.png", background = transparent)
  save_png(make_diverging_chart_reference_labeled_layer(), "cdc-places-diabetes-diverging-chart-layer-reference-labeled.png", background = transparent)

  save_diverging_classification_layers <- function(
    prefix,
    fill_column,
    labels,
    summary_data,
    variant,
    hatches,
    below_points
  ) {
    reversed_labels <- rev(labels)
    above_variant_labels <- reversed_labels[grepl("above", reversed_labels, ignore.case = TRUE)]
    below_variant_labels <- reversed_labels[grepl("below", reversed_labels, ignore.case = TRUE)]
    original_palette <- diverging_palette_for_variant(FALSE, variant)
    redesign_palette <- diverging_palette_for_variant(TRUE, variant)
    alt_palette <- diverging_palette_for_variant("alt", variant)

    save_png(
      map_color_layer(fill_column, original_palette, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
      paste0(prefix, "-map-layer-color-p0.png"),
      legend = map_layer_legend_colors("Difference", reversed_labels, original_palette)
    )
    save_png(
      map_color_layer(fill_column, redesign_palette, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
      paste0(prefix, "-map-layer-color-p1.png"),
      legend = map_layer_legend_colors("Difference", reversed_labels, redesign_palette)
    )
    save_png(
      map_color_layer(fill_column, alt_palette, "Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
      paste0(prefix, "-map-layer-color-p2.png"),
      legend = map_layer_legend_colors("Difference", reversed_labels, alt_palette)
    )
    save_png(
      map_structure_layer("Diagnosed Diabetes Relative to Texas Average", average_caption, source_caption),
      paste0(prefix, "-map-layer-structure.png"),
      legend = map_layer_legend_structure("Difference", reversed_labels, original_palette),
      background = transparent
    )
    save_png(
      make_diverging_map_cue_layer(),
      paste0(prefix, "-map-layer-cue.png"),
      legend = map_layer_legend_cues("Difference", reversed_labels, original_palette, stipple_labels = above_variant_labels),
      background = transparent
    )
    save_png(
      make_diverging_map_cue_alt_layer(),
      paste0(prefix, "-map-layer-cue-alt.png"),
      legend = map_layer_legend_two_sided_cues(
        "Difference",
        reversed_labels,
        original_palette,
        above_variant_labels,
        below_variant_labels
      ),
      background = transparent
    )

    save_png(make_diverging_chart_color_layer(FALSE, summary_data, labels, variant), paste0(prefix, "-chart-layer-color-p0.png"))
    save_png(make_diverging_chart_color_layer(TRUE, summary_data, labels, variant), paste0(prefix, "-chart-layer-color-p1.png"))
    save_png(make_diverging_chart_color_layer("alt", summary_data, labels, variant), paste0(prefix, "-chart-layer-color-p2.png"))
    save_png(make_diverging_chart_structure_layer(summary_data, labels), paste0(prefix, "-chart-layer-structure.png"), background = transparent)
    save_png(make_diverging_chart_cue_layer(summary_data, labels, hatches), paste0(prefix, "-chart-layer-cue.png"), background = transparent)
    save_png(
      make_diverging_chart_cue_alt_layer(summary_data, labels, hatches, below_points),
      paste0(prefix, "-chart-layer-cue-alt.png"),
      background = transparent
    )
  }

  save_diverging_classification_layers(
    "cdc-places-diabetes-diverging-simple",
    "diabetes_difference_simple_class",
    deviation_simple_labels,
    difference_summary_simple,
    "simple",
    difference_bar_hatches_simple,
    difference_bar_below_points_simple
  )
  save_diverging_classification_layers(
    "cdc-places-diabetes-diverging-direction",
    "diabetes_difference_direction_class",
    deviation_direction_labels,
    difference_summary_direction,
    "direction",
    difference_bar_hatches_direction,
    difference_bar_below_points_direction
  )

  save_png(
    map_color_layer("svi_theme", svi_fragile_palette, "Highest-Ranked SVI Theme by County", "Texas counties, CDC/ATSDR SVI 2022", svi_caption),
    "cdc-svi-theme-map-layer-color-p0.png",
    legend = map_layer_legend_colors("Highest SVI theme", reversed_svi_labels, svi_fragile_palette)
  )
  save_png(
    map_color_layer("svi_theme", svi_robust_palette, "Highest-Ranked SVI Theme by County", "Texas counties, CDC/ATSDR SVI 2022", svi_caption),
    "cdc-svi-theme-map-layer-color-p1.png",
    legend = map_layer_legend_colors("Highest SVI theme", reversed_svi_labels, svi_robust_palette)
  )
  save_png(
    map_color_layer("svi_theme", svi_palette_alt, "Highest-Ranked SVI Theme by County", "Texas counties, CDC/ATSDR SVI 2022", svi_caption),
    "cdc-svi-theme-map-layer-color-p2.png",
    legend = map_layer_legend_colors("Highest SVI theme", reversed_svi_labels, svi_palette_alt)
  )
  save_png(
    map_structure_layer("Highest-Ranked SVI Theme by County", "Texas counties, CDC/ATSDR SVI 2022", svi_caption),
    "cdc-svi-theme-map-layer-structure.png",
    legend = map_layer_legend_structure("Highest SVI theme", reversed_svi_labels, svi_fragile_palette),
    background = transparent
  )
  save_png(
    make_svi_map_cue_layer(),
    "cdc-svi-theme-map-layer-cue.png",
    legend = map_layer_legend_cues(
      "Highest SVI theme",
      reversed_svi_labels,
      svi_fragile_palette,
      symbol_shapes = svi_shapes,
      symbol_fills = svi_symbol_fills,
      symbol_outlines = svi_symbol_outlines,
      symbol_sizes = svi_legend_symbol_sizes,
      symbol_counts = svi_legend_symbol_counts
    ),
    background = transparent
  )
  save_png(
    make_svi_map_cue_alt_layer(),
    "cdc-svi-theme-map-layer-cue-alt.png",
    legend = map_layer_legend_cues(
      "Highest SVI theme",
      reversed_svi_labels,
      svi_fragile_palette,
      symbol_shapes = svi_cue_alt_shapes,
      symbol_fills = svi_cue_alt_symbol_fills,
      symbol_outlines = svi_cue_alt_symbol_outlines,
      symbol_sizes = svi_cue_alt_legend_symbol_sizes,
      symbol_counts = svi_cue_alt_legend_symbol_counts
    ),
    background = transparent
  )
  save_png(make_svi_map_label_layer(), "cdc-svi-theme-map-layer-labels.png", background = transparent)
  save_png(make_svi_map_all_label_layer(), "cdc-svi-theme-map-layer-all-labels.png", background = transparent)
  save_png(make_svi_chart_color_layer(FALSE), "cdc-svi-theme-chart-layer-color-p0.png")
  save_png(make_svi_chart_color_layer(TRUE), "cdc-svi-theme-chart-layer-color-p1.png")
  save_png(make_svi_chart_color_layer("alt"), "cdc-svi-theme-chart-layer-color-p2.png")
  save_png(make_svi_chart_structure_layer(), "cdc-svi-theme-chart-layer-structure.png", background = transparent)
  save_png(make_svi_chart_cue_layer(), "cdc-svi-theme-chart-layer-cue.png", background = transparent)
  save_png(make_svi_chart_cue_alt_layer(), "cdc-svi-theme-chart-layer-cue-alt.png", background = transparent)
  save_png(make_svi_chart_label_layer(), "cdc-svi-theme-chart-layer-labels.png", background = transparent)

  for (spec in transfer_map_specs) {
    transfer_map <- make_transfer_challenge_map(spec)
    save_png(
      transfer_map$plot,
      paste0("transfer-", spec$id, ".png"),
      legend = transfer_map$legend
    )
  }
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
    plot <- add_svi_map_symbol_layers(plot, svi_symbol_points)
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
    labs(
      title = "Highest-Ranked SVI Theme by County",
      subtitle = intervention_subtitle(
        "Original: theme identity relies on similarly valued hues",
        c(
          if (palette) "robust palette" else "",
          if (redundant) "density-coded texture markers" else "",
          if (labels) "selected county labels" else ""
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
    plot <- add_svi_chart_symbol_layers(plot, svi_chart_symbols)
  }

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
    scale_y_discrete(labels = function(values) unname(svi_theme_short_labels[values])) +
    scale_x_continuous(expand = expansion(mult = c(0, if (labels) 0.28 else 0.14))) +
    labs(
      title = "County Count by Highest-Ranked SVI Theme",
      subtitle = intervention_subtitle(
        "Original: bars keep labels, but color still carries cross-view identity",
        c(
          if (palette) "robust palette" else "",
          if (redundant) "matching density-coded markers" else "",
          if (labels) "direct counts and percentages" else ""
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
        symbol_shapes = if (redundant) svi_shapes else NULL,
        symbol_fills = if (redundant) svi_symbol_fills else NULL,
        symbol_outlines = if (redundant) svi_symbol_outlines else NULL,
        symbol_sizes = if (redundant) svi_legend_symbol_sizes else NULL,
        symbol_counts = if (redundant) svi_legend_symbol_counts else NULL
      )
    )
    save_png(
      make_categorical_chart(palette, redundant, labels),
      paste0("cdc-svi-theme-chart-", suffix, ".png")
    )
  }
}

save_layer_assets()

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
    "Layered figure assets:",
    "",
    "The app composes each map or chart from aligned PNG layers instead of",
    "loading a pre-rendered image for every intervention combination.",
    "Transfer challenge maps use standalone `transfer-*.png` images generated",
    "from additional CDC PLACES public-health measures.",
    "",
    "Each example prefix has map and chart layers:",
    "",
    "- `*-map-layer-color-p0.png`: original color fills",
    "- `*-map-layer-color-p1.png`: alternate palette or luminance color fills",
    "- `*-map-layer-color-p2.png`: optional second alternate palette color fills",
    "- `*-map-layer-structure.png`: titles, axes, boundaries, legend text, and other persistent structure",
    "- `*-map-layer-structure-no-boundaries.png`: optional title, outline, and legend text layer without internal map boundaries",
    "- `*-map-layer-cue.png`: redundant markers, patterns, hatches, or stronger boundaries",
    "- `*-map-layer-cue-alt.png`: optional second marker or pattern cue overlay",
    "- `*-map-layer-labels.png`: direct labels and annotations",
    "- `*-map-layer-all-labels.png`: optional high-density all-county label overlay",
    "- `*-map-layer-annotation.png`: optional threshold, reference, or explanatory annotation overlay",
    "- `*-map-layer-reference-divider.png`: optional explicit midpoint divider overlay",
    "- `*-map-layer-reference-labeled.png`: optional explicitly labeled midpoint overlay",
    "- `*-chart-layer-color-p0.png`: original chart color fills",
    "- `*-chart-layer-color-p1.png`: alternate chart color fills",
    "- `*-chart-layer-color-p2.png`: optional second alternate chart palette color fills",
    "- `*-chart-layer-structure.png`: axes, grid, titles, and persistent chart text",
    "- `*-chart-layer-cue.png`: chart outlines, hatches, or marker cues",
    "- `*-chart-layer-cue-alt.png`: optional second chart marker or pattern cue overlay",
    "- `*-chart-layer-labels.png`: chart labels and annotations",
    "- `*-chart-layer-annotation.png`: optional threshold, reference, or explanatory annotation overlay",
    "- `*-chart-layer-reference-divider.png`: optional explicit midpoint divider overlay",
    "- `*-chart-layer-reference-labeled.png`: optional explicitly labeled midpoint overlay",
    "",
    "Current example prefixes:",
    "",
    "- `cdc-places-diabetes`",
    "- `cdc-places-diabetes-diverging`",
    "- `cdc-places-diabetes-diverging-simple`",
    "- `cdc-places-diabetes-diverging-direction`",
    "- `cdc-svi-theme`",
    "- `transfer-*`",
    "",
    "The categorical example maps the SVI theme with the highest county percentile",
    "ranking. The four categories are socioeconomic status, household characteristics,",
    "racial/ethnic minority status, and housing/transportation. The theme colors encode",
    "nominal identity, not rank.",
    "",
    "Layer order in the app is color fill first, then structure, then optional",
    "redundant cue and label overlays. This keeps non-color cues above the color",
    "fill layer and makes future interventions easier to add without multiplying",
    "exported image combinations.",
    "",
    "- `cdc-places-diabetes-texas-counties.csv`",
    "- `cdc-places-transfer-texas-counties.csv`",
    "- `cdc-svi-texas-counties-2022.csv`"
  ),
  file.path(output_dir, "README.md")
)
