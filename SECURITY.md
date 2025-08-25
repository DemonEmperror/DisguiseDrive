# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in DisguiseDrive, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to: [security@disguisedrive.com] (replace with actual email)
3. Include detailed information about the vulnerability
4. Allow reasonable time for response and fix

## Security Features

### Encryption
- **Client-side encryption**: All images are encrypted on the client before upload
- **AES-256-GCM**: Industry-standard authenticated encryption
- **Argon2**: Memory-hard password derivation function
- **Per-image passwords**: Each image has its own encryption password
- **Key derivation**: Passwords are never stored, only derived keys

### Storage Security
- **Private S3 buckets**: Encrypted blobs stored in private storage
- **No plaintext storage**: Server never stores unencrypted images
- **Secure key management**: File keys encrypted with user passwords
- **Deterministic covers**: Generated covers reveal nothing about originals

### Access Control
- **JWT authentication**: Secure token-based authentication
- **Folder-level protection**: Optional password protection for folders
- **Short-lived tokens**: Folder access tokens expire automatically
- **Rate limiting**: Protection against brute force attacks

### Security Logging
- **Audit trail**: All security events are logged
- **Failed attempts**: Wrong password attempts are tracked
- **IP tracking**: Source IP addresses logged for security events

## Known Limitations

### Client-Side Display
- **Screenshots**: Cannot prevent screenshots of decrypted images
- **Screen recording**: Cannot prevent screen recording
- **Memory dumps**: Advanced attackers could potentially access client memory
- **Browser cache**: Temporary data may exist in browser memory

### Network Security
- **HTTPS required**: All production deployments must use HTTPS
- **Man-in-the-middle**: Ensure proper certificate validation
- **DNS security**: Use secure DNS resolution

### Physical Security
- **Device access**: Physical access to unlocked devices compromises security
- **Shoulder surfing**: Visual observation of passwords during entry
- **Biometric bypass**: Device biometrics may bypass app-level security

## Best Practices

### For Users
1. **Strong passwords**: Use unique, strong passwords for accounts and images
2. **Password management**: Store passwords in a secure password manager
3. **Device security**: Keep devices locked and updated
4. **Network security**: Avoid public WiFi for sensitive operations
5. **Regular cleanup**: Clear browser data regularly

### For Administrators
1. **HTTPS enforcement**: Always use HTTPS in production
2. **Database security**: Secure database connections and access
3. **Key management**: Use proper key management systems (AWS KMS recommended)
4. **Monitoring**: Monitor security logs for suspicious activity
5. **Updates**: Keep all dependencies updated
6. **Backups**: Secure backup procedures for encrypted data

### For Developers
1. **Code review**: All security-related code must be reviewed
2. **Dependency scanning**: Regular security audits of dependencies
3. **Static analysis**: Use static analysis tools for security issues
4. **Penetration testing**: Regular security testing
5. **Secure defaults**: Default configurations should be secure

## Threat Model

### What We Protect Against
- ✅ Unauthorized access to original images
- ✅ Server-side data breaches
- ✅ Direct download of images
- ✅ Brute force password attacks
- ✅ Man-in-the-middle attacks (with HTTPS)

### What We Cannot Protect Against
- ❌ Screenshots of displayed images
- ❌ Screen recording during viewing
- ❌ Physical device compromise
- ❌ Malware on client devices
- ❌ Social engineering attacks
- ❌ Quantum computing attacks (future threat)

## Compliance

### Data Protection
- **GDPR**: User data can be deleted on request
- **CCPA**: California privacy rights supported
- **Data minimization**: Only necessary data is collected
- **Right to deletion**: Users can delete all their data

### Industry Standards
- **OWASP**: Following OWASP security guidelines
- **NIST**: Aligned with NIST cybersecurity framework
- **ISO 27001**: Security management best practices

## Security Updates

Security updates will be released as soon as possible after discovery and verification. Users will be notified through:

1. GitHub security advisories
2. Release notes
3. Email notifications (if subscribed)
4. In-app notifications for critical updates

## Contact

For security-related questions or concerns:
- Security Email: [security@disguisedrive.com]
- General Issues: GitHub Issues (for non-security bugs only)
- Documentation: See README.md for general information

---

**Remember**: No security system is perfect. DisguiseDrive provides strong protection for your images, but users should understand the limitations and use appropriate operational security practices.
