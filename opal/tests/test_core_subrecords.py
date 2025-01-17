from opal.core.test import OpalTestCase
from opal.core import subrecords
from opal.tests.models import HatWearer, FamousLastWords


class TestSubrecords(OpalTestCase):
    def test_get_patient_subrecords(self):
        patient_subrecords = [i for i in subrecords.patient_subrecords()]
        self.assertIn(FamousLastWords, patient_subrecords)
        self.assertNotIn(HatWearer, patient_subrecords)

    def test_get_episode_subrecords(self):
        episode_subrecords = [i for i in subrecords.episode_subrecords()]
        self.assertNotIn(FamousLastWords, episode_subrecords)
        self.assertIn(HatWearer, episode_subrecords)

    def test_subrecords(self):
        all_subrecords = [i for i in subrecords.subrecords()]
        self.assertIn(FamousLastWords, all_subrecords)
        self.assertIn(HatWearer, all_subrecords)

    def test_get_get_subrecord_from_api_name(self):
        hatwearer_api_name = HatWearer.get_api_name()
        famous_api_name = FamousLastWords.get_api_name()
        self.assertEqual(
            HatWearer,
            subrecords.get_subrecord_from_api_name(hatwearer_api_name)
        )

        self.assertEqual(
            FamousLastWords,
            subrecords.get_subrecord_from_api_name(famous_api_name)

        )

    def test_get_get_subrecord_from_model_name(self):
        self.assertEqual(
            HatWearer,
            subrecords.get_subrecord_from_model_name("HatWearer")
        )

        self.assertEqual(
            FamousLastWords,
            subrecords.get_subrecord_from_model_name("FamousLastWords")
        )
