# 🔧 Cara Install AWS CLI di Mac

Ada beberapa cara untuk install AWS CLI di Mac. Pilih yang paling mudah untuk Anda.

## ✅ Opsi 1: Menggunakan Homebrew (Paling Mudah - Recommended)

```bash
# Install Homebrew (jika belum ada)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install AWS CLI
brew install awscli

# Verify installation
aws --version
```

**Keuntungan:**
- Otomatis detect architecture (Intel atau Apple Silicon)
- Mudah update: `brew upgrade awscli`
- Tidak perlu manual download/extract

## ✅ Opsi 2: Installer Bundle (Untuk Mac)

```bash
# Download installer untuk Mac
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"

# Install dengan installer GUI
open AWSCLIV2.pkg

# Atau install via command line
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify
aws --version
```

## ✅ Opsi 3: Manual Install (Fix Error yang Anda Alami)

Jika sudah download tapi error, kemungkinan file corrupt atau salah architecture:

```bash
# 1. Hapus instalasi yang gagal
sudo rm -rf /usr/local/bin/aws
sudo rm -rf /usr/local/bin/aws_completer
sudo rm -rf /usr/local/aws-cli
sudo rm -rf ~/aws

# 2. Download ulang (cek architecture dulu)
ARCH=$(uname -m)
echo "Your architecture: $ARCH"

# Untuk Intel Mac (x86_64)
if [ "$ARCH" = "x86_64" ]; then
    curl "https://awscli.amazonaws.com/awscli-exe-darwin-x86_64.zip" -o "awscliv2.zip"
fi

# Untuk Apple Silicon Mac (arm64)
if [ "$ARCH" = "arm64" ]; then
    curl "https://awscli.amazonaws.com/awscli-exe-darwin-arm64.zip" -o "awscliv2.zip"
fi

# 3. Extract dan install
unzip awscliv2.zip
sudo ./aws/install

# 4. Verify
aws --version

# 5. Cleanup
rm -rf awscliv2.zip aws
```

## 🔍 Troubleshooting

### Error: "cannot execute binary file"

**Solusi:**
1. Pastikan download versi yang sesuai dengan architecture Mac Anda
2. Cek architecture: `uname -m`
   - `x86_64` = Intel Mac → download `darwin-x86_64`
   - `arm64` = Apple Silicon (M1/M2/M3) → download `darwin-arm64`
3. Atau gunakan Homebrew (otomatis detect)

### Error: "Permission denied"

```bash
# Pastikan file executable
chmod +x ./aws/install
sudo ./aws/install
```

### AWS CLI sudah terinstall tapi tidak ditemukan

```bash
# Cek apakah ada di PATH
which aws

# Jika tidak ada, tambahkan ke PATH
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Atau untuk bash
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

## ⚙️ Setup AWS Credentials

Setelah install, configure credentials:

```bash
# Configure AWS credentials
aws configure

# Akan diminta:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (contoh: us-east-1)
# - Default output format (json)

# Verify configuration
aws sts get-caller-identity
```

## 📚 Referensi

- [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Homebrew](https://brew.sh/)
