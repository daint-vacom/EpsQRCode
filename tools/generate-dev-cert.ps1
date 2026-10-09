$ErrorActionPreference = 'Stop'

$certificateDirectory = Join-Path $PSScriptRoot '..\.cert'
$certificatePath = Join-Path $certificateDirectory 'localhost.pfx'
$certificatePassword = ConvertTo-SecureString 'epsqrcode-local-dev' -AsPlainText -Force

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

$certificate = New-SelfSignedCertificate `
  -DnsName 'localhost' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -FriendlyName 'EpsQRCode local HTTPS' `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(2)

try {
  Export-PfxCertificate `
    -Cert $certificate `
    -FilePath $certificatePath `
    -Password $certificatePassword | Out-Null
}
finally {
  Remove-Item "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -ErrorAction SilentlyContinue
}

Write-Output 'Created local HTTPS certificate in .cert/localhost.pfx.'
