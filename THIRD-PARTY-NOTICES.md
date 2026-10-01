# Third-Party Notices

This file lists third-party source materials copied into the repository rather
than installed through the package manager.

## Colour Science CVD Matrices

`src/config/stressTests.js` includes precomputed color vision deficiency
simulation matrices from the Colour Science project:

- Source project: <https://github.com/colour-science/colour>
- Source file: `colour/blindness/datasets/machado2010.py`
- Material used: Machado 2009/2010 CVD simulation matrices for protanomaly,
  deuteranomaly, and tritanomaly.
- License: BSD-3-Clause

Copyright 2013 Colour Developers

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

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
INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT INCLUDING
NEGLIGENCE OR OTHERWISE ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Public-Health Data And Boundaries

The repository includes cached tabular extracts and derived PNG figures generated
from the following public sources:

- CDC PLACES County Data GIS-Friendly Format, 2025 release:
  <https://data.cdc.gov/resource/i46a-9kgh>
- CDC/ATSDR Social Vulnerability Index 2022 Texas county data:
  <https://services2.arcgis.com/LYMgRMwHfrWWEg3s/ArcGIS/rest/services/CDC_Texas_Social_Vulnerability_Index_County_2022/FeatureServer>
- U.S. Census Bureau cartographic county boundaries retrieved through the
  `tigris` R package.

The generated figures are transformed educational materials and are covered by
the repository's content license only to the extent the contributors hold rights
in those transformations. Source data and geographic boundaries remain subject to
their source terms and attribution requirements. The generation script records
the queried fields and missing-data treatment.

## Package Dependencies

JavaScript and R packages are not copied into this repository as source material.
They retain their own licenses. JavaScript package versions and integrity hashes
are recorded in `package-lock.json`; R dependencies are listed in `README.md` and
loaded explicitly by the asset-generation script.
