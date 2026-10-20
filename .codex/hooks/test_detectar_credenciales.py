import unittest

from detectar_credenciales import find_credentials


class DetectarCredencialesTests(unittest.TestCase):
    def test_detects_provider_tokens_without_printing_their_values(self):
        patch = "\n".join(
            [
                "*** Begin Patch",
                "*** Add File: src/config.ts",
                '+const aws = "AKIA' + "A" * 16 + '";',
                '+const awsSecret = { secretAccessKey: "' + "b" * 40 + '" };',
                '+const github = "ghp_' + "b" * 36 + '";',
                "*** End Patch",
            ]
        )

        self.assertEqual(
            find_credentials(patch),
            [
                ("src/config.ts", "AWS access key ID"),
                ("src/config.ts", "AWS secret access key"),
                ("src/config.ts", "GitHub token"),
            ],
        )

    def test_detects_private_key_header(self):
        patch = "*** Begin Patch\n*** Update File: src/key.ts\n+-----BEGIN PRIVATE KEY-----\n*** End Patch"
        self.assertEqual(find_credentials(patch), [("src/key.ts", "private key")])

    def test_ignores_removed_lines_and_safe_placeholders(self):
        patch = "\n".join(
            [
                "*** Begin Patch",
                "*** Update File: src/config.ts",
                '-const old = "AKIA' + "A" * 16 + '";',
                '+const example = "replace-with-local-password";',
                "*** End Patch",
            ]
        )
        self.assertEqual(find_credentials(patch), [])


if __name__ == "__main__":
    unittest.main()
