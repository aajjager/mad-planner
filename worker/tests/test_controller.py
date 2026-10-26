import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import json

spec = importlib.util.spec_from_file_location('controller', Path(__file__).resolve().parents[1] / 'controller.py')
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)
proxy_spec = importlib.util.spec_from_file_location('egress_proxy', Path(__file__).resolve().parents[1] / 'egress_proxy.py')
proxy = importlib.util.module_from_spec(proxy_spec)
proxy_spec.loader.exec_module(proxy)


class Boundaries(unittest.TestCase):
    def test_version_only_update_requires_current_release_and_no_other_manifest_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            before, after = Path(temp) / 'before', Path(temp) / 'after'
            original = '[project]\nname="app"\nversion="0.10.3"\ndependencies=["safe==1"]\n[build-system]\nrequires=["hatchling"]\n'
            for root in (before, after):
                (root / 'apps/api').mkdir(parents=True)
                (root / 'apps/api/pyproject.toml').write_text(original)
                (root / 'CHANGELOG.md').write_text('## 0.10.3\nOld release')
                (root / 'feature.py').write_text('original')
            (after / 'feature.py').write_text('fixed')
            (after / 'CHANGELOG.md').write_text('## 0.10.4\n### Bug fixes\n- Fix feature\n')
            candidate = original.replace('0.10.3', '0.10.4')
            (after / 'apps/api/pyproject.toml').write_text(candidate)
            with patch.object(controller, 'calendar_version', return_value='0.10.4'):
                self.assertIn('apps/api/pyproject.toml', controller.verify_changes(before, after))
                for mutation in (candidate.replace('safe==1', 'unsafe==2'), candidate.replace('hatchling', 'other-build'), candidate.replace('0.10.4', '0.10.2')):
                    (after / 'apps/api/pyproject.toml').write_text(mutation)
                    with self.assertRaises(ValueError): controller.verify_changes(before, after)
                (after / 'apps/api/pyproject.toml').write_text(candidate)
                (after / 'CHANGELOG.md').write_text('## 0.10.3\nWrong release')
                with self.assertRaises(ValueError): controller.verify_changes(before, after)
                (after / 'CHANGELOG.md').write_text('## 0.10.4\n### Bug fixes\n- Fix feature\n')
                (after / 'feature.py').write_text('original')
                with self.assertRaises(ValueError): controller.verify_changes(before, after)

    def test_ignored_dependency_link_is_not_followed_and_only_link_is_removed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'source'
            (source / 'apps/web').mkdir(parents=True)
            outside = root / 'outside'
            outside.mkdir()
            (outside / 'keep.txt').write_text('untouched')
            link = source / 'apps/web/node_modules'
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError as error:
                self.skipTest(str(error))
            self.assertEqual(controller.safe_files(source), {})
            controller.prepare_validation(source)
            self.assertFalse(link.is_symlink())
            self.assertEqual((outside / 'keep.txt').read_text(), 'untouched')
            # A broken dependency link is ignored as well, but source links are rejected.
            link.symlink_to(root / 'missing', target_is_directory=True)
            self.assertEqual(controller.safe_files(source), {})
            (source / 'published.py').symlink_to(outside / 'keep.txt')
            with self.assertRaisesRegex(ValueError, 'Symlinks'):
                controller.safe_files(source)

    def test_preview_export_contains_only_api_source_without_caches(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            api = root / 'source/apps/api'
            (api / 'src').mkdir(parents=True)
            (api / 'src/main.py').write_text('print("preview")')
            (api / '__pycache__').mkdir()
            (api / '__pycache__/main.pyc').write_bytes(b'cache')
            (root / 'source/secret.txt').write_text('outside api')
            exported = controller.prepare_preview_api(root / 'source', root / 'export')
            self.assertEqual((exported / 'src/main.py').read_text(), 'print("preview")')
            self.assertFalse((exported / '__pycache__').exists())
            self.assertFalse((exported / 'secret.txt').exists())

    def test_api_identifies_worker_and_preserves_authentication(self):
        worker = object.__new__(controller.Controller)
        worker.config = {'app_url': 'https://example.invalid', 'worker_token': 'test-token'}
        response = Mock()
        response.read.return_value = b'null'
        with patch.object(controller.urllib.request, 'urlopen') as send:
            send.return_value.__enter__.return_value = response
            self.assertIsNone(worker.api('worker/claim', {}))
            request = send.call_args.args[0]
            self.assertEqual(request.get_header('User-agent'), 'MadPlanner-Worker/1.0')
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-token')

    def test_agent_proxy_only_allows_exact_openai_hosts_on_tls_port(self):
        self.assertTrue(proxy.permitted('api.openai.com', '443'))
        for host, port in [('192.168.1.19', '443'), ('github.com', '443'), ('api.openai.com.evil.test', '443'), ('api.openai.com', '80'), ('localhost', '443')]:
            self.assertFalse(proxy.permitted(host, port))
    def test_approval_requires_exact_head_base_branch_and_open_review(self):
        details = {'head_sha': 'a' * 40, 'approved_sha': 'a' * 40, 'base_sha': 'b' * 40, 'branch': 'codex/job-1'}
        current = {'headRefOid': 'a' * 40, 'baseRefOid': 'b' * 40, 'headRefName': 'codex/job-1', 'baseRefName': 'main', 'state': 'OPEN', 'mergeable': 'MERGEABLE', 'isDraft': False}
        self.assertTrue(controller.approval_matches(details, current))
        for key, value in [('headRefOid', 'c' * 40), ('baseRefOid', 'c' * 40), ('headRefName', 'other'), ('baseRefName', 'other'), ('state', 'CLOSED'), ('isDraft', True), ('mergeable', 'CONFLICTING')]:
            self.assertFalse(controller.approval_matches(details, {**current, key: value}), key)

    def test_only_source_changes_with_changelog_are_allowed(self):
        with tempfile.TemporaryDirectory() as temp:
            before, after = Path(temp) / 'before', Path(temp) / 'after'
            before.mkdir(); after.mkdir()
            for root in (before, after):
                (root / 'CHANGELOG.md').write_text('Original')
                (root / '.env.example').write_text('No secrets')
            (after / 'feature.py').write_text('print("feature")')
            with self.assertRaises(ValueError): controller.verify_changes(before, after)
            (after / 'CHANGELOG.md').write_text('Improvement')
            self.assertEqual(controller.verify_changes(before, after), {'feature.py', 'CHANGELOG.md'})
            (after / '.env.example').write_text('Changed config')
            with self.assertRaises(ValueError): controller.verify_changes(before, after)

    def test_concurrent_main_update_rejects_push_without_reporting_merged(self):
        worker = object.__new__(controller.Controller)
        worker.root = Path('/unused')
        worker.job = {'id': 1, 'revision': 1, 'details': {'head_sha': 'a' * 40, 'approved_sha': 'a' * 40, 'base_sha': 'b' * 40, 'branch': 'codex/job-1', 'pr_number': 3}}
        current = {'headRefOid': 'a' * 40, 'baseRefOid': 'b' * 40, 'headRefName': 'codex/job-1', 'baseRefName': 'main', 'state': 'OPEN', 'mergeable': 'MERGEABLE', 'isDraft': False}
        worker.run = Mock(side_effect=[json.dumps(current), ''])
        worker.git = Mock(side_effect=['b' * 40, '', '', 'tested-tree', 'tested-tree', RuntimeError('non-fast-forward')])
        worker.report = Mock()
        with self.assertRaisesRegex(RuntimeError, 'non-fast-forward'): worker.merge()
        worker.report.assert_not_called()
        self.assertEqual(worker.git.call_args.args[1:], ('push', 'origin', 'HEAD:refs/heads/main'))


if __name__ == '__main__':
    unittest.main()
