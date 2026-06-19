import { type Citation } from '@fasl-work/caos-app-shell';

// Canonical references for the methodology pages (DOI-verified during deep research).
export const CITATIONS: Citation[] = [
  { id: 'randall2011', label: 'Randall & Antoni 2011', citation: 'Randall, R.B. & Antoni, J. (2011). Rolling element bearing diagnostics — a tutorial. Mechanical Systems and Signal Processing 25(2), 485–520.', doi: '10.1016/j.ymssp.2010.07.017' },
  { id: 'antoni2006sk', label: 'Antoni & Randall 2006', citation: 'Antoni, J. & Randall, R.B. (2006). The spectral kurtosis: application to the vibratory surveillance and diagnostics of rotating machines. MSSP 20(2), 308–331.', doi: '10.1016/j.ymssp.2004.09.002' },
  { id: 'antoni2007', label: 'Antoni 2007', citation: 'Antoni, J. (2007). Fast computation of the kurtogram for the detection of transient faults. MSSP 21(1), 108–124.', doi: '10.1016/j.ymssp.2005.12.002' },
  { id: 'smith2015', label: 'Smith & Randall 2015', citation: 'Smith, W.A. & Randall, R.B. (2015). Rolling element bearing diagnostics using the Case Western Reserve University data: a benchmark study. MSSP 64–65, 100–131.', doi: '10.1016/j.ymssp.2015.04.021' },
  { id: 'borghesani2013', label: 'Borghesani et al. 2013', citation: 'Borghesani, P. et al. (2013). Application of cepstrum pre-whitening for the diagnosis of bearing faults under variable speed. MSSP 36(2), 370–384.', doi: '10.1016/j.ymssp.2012.11.001' },
  { id: 'lei2018', label: 'Lei et al. 2018', citation: 'Lei, Y. et al. (2018). Machinery health prognostics: A systematic review from data acquisition to RUL prediction. MSSP 104, 799–834.', doi: '10.1016/j.ymssp.2017.11.016' },
  { id: 'iso20816', label: 'ISO 20816-1:2016', citation: 'ISO 20816-1:2016 — Mechanical vibration — Measurement and evaluation of machine vibration. Part 1: General guidelines (severity zones A/B/C/D).', url: 'https://www.iso.org/standard/63239.html' },
];
