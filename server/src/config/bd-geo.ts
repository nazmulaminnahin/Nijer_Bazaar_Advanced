/**
 * Bangladesh administrative data used by the checkout form.
 * Divisions and all 64 districts are listed. Police-station (thana) names are
 * provided as suggestions for the busiest districts; the API accepts a free-text
 * thana for every other district (validated by length) rather than inventing an
 * incomplete list.
 */
export interface District {
  name: string;
  nameBn: string;
  thanas?: string[];
}

export interface Division {
  name: string;
  nameBn: string;
  districts: District[];
}

const dhakaThanas = [
  'Adabor', 'Badda', 'Banani', 'Bangshal', 'Cantonment', 'Chakbazar', 'Dakshinkhan', 'Darus Salam',
  'Demra', 'Dhanmondi', 'Gendaria', 'Gulshan', 'Hazaribagh', 'Jatrabari', 'Kadamtali', 'Kafrul',
  'Kalabagan', 'Kamrangirchar', 'Khilgaon', 'Khilkhet', 'Kotwali', 'Lalbagh', 'Mirpur', 'Mohammadpur',
  'Motijheel', 'Mugda', 'New Market', 'Pallabi', 'Paltan', 'Ramna', 'Rampura', 'Sabujbagh',
  'Shahbagh', 'Shah Ali', 'Sher-e-Bangla Nagar', 'Shyampur', 'Sutrapur', 'Tejgaon', 'Turag', 'Uttara',
  'Vatara', 'Wari',
];

export const BD_DIVISIONS: Division[] = [
  {
    name: 'Dhaka', nameBn: 'ঢাকা',
    districts: [
      { name: 'Dhaka', nameBn: 'ঢাকা', thanas: dhakaThanas },
      { name: 'Gazipur', nameBn: 'গাজীপুর', thanas: ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'] },
      { name: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', thanas: ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon', 'Siddhirganj'] },
      { name: 'Tangail', nameBn: 'টাঙ্গাইল' }, { name: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ' },
      { name: 'Manikganj', nameBn: 'মানিকগঞ্জ' }, { name: 'Munshiganj', nameBn: 'মুন্সিগঞ্জ' },
      { name: 'Narsingdi', nameBn: 'নরসিংদী' }, { name: 'Faridpur', nameBn: 'ফরিদপুর' },
      { name: 'Gopalganj', nameBn: 'গোপালগঞ্জ' }, { name: 'Madaripur', nameBn: 'মাদারীপুর' },
      { name: 'Rajbari', nameBn: 'রাজবাড়ী' }, { name: 'Shariatpur', nameBn: 'শরীয়তপুর' },
    ],
  },
  {
    name: 'Chattogram', nameBn: 'চট্টগ্রাম',
    districts: [
      { name: 'Chattogram', nameBn: 'চট্টগ্রাম', thanas: ['Kotwali', 'Panchlaish', 'Double Mooring', 'Pahartali', 'Halishahar', 'Bakalia', 'Bayezid', 'Patenga', 'Sitakunda', 'Mirsharai', 'Hathazari', 'Raozan'] },
      { name: 'Coxs Bazar', nameBn: 'কক্সবাজার' }, { name: 'Cumilla', nameBn: 'কুমিল্লা' },
      { name: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া' }, { name: 'Chandpur', nameBn: 'চাঁদপুর' },
      { name: 'Feni', nameBn: 'ফেনী' }, { name: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর' },
      { name: 'Noakhali', nameBn: 'নোয়াখালী' }, { name: 'Khagrachhari', nameBn: 'খাগড়াছড়ি' },
      { name: 'Rangamati', nameBn: 'রাঙ্গামাটি' }, { name: 'Bandarban', nameBn: 'বান্দরবান' },
    ],
  },
  {
    name: 'Rajshahi', nameBn: 'রাজশাহী',
    districts: [
      { name: 'Rajshahi', nameBn: 'রাজশাহী' }, { name: 'Bogura', nameBn: 'বগুড়া' },
      { name: 'Pabna', nameBn: 'পাবনা' }, { name: 'Sirajganj', nameBn: 'সিরাজগঞ্জ' },
      { name: 'Natore', nameBn: 'নাটোর' }, { name: 'Naogaon', nameBn: 'নওগাঁ' },
      { name: 'Nawabganj', nameBn: 'নবাবগঞ্জ' }, { name: 'Joypurhat', nameBn: 'জয়পুরহাট' },
    ],
  },
  {
    name: 'Khulna', nameBn: 'খুলনা',
    districts: [
      { name: 'Khulna', nameBn: 'খুলনা' }, { name: 'Jashore', nameBn: 'যশোর' },
      { name: 'Jhenaidah', nameBn: 'ঝিনাইদহ' }, { name: 'Kushtia', nameBn: 'কুষ্টিয়া' },
      { name: 'Magura', nameBn: 'মাগুরা' }, { name: 'Meherpur', nameBn: 'মেহেরপুর' },
      { name: 'Narail', nameBn: 'নড়াইল' }, { name: 'Bagerhat', nameBn: 'বাগেরহাট' },
      { name: 'Satkhira', nameBn: 'সাতক্ষীরা' }, { name: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা' },
    ],
  },
  {
    name: 'Barishal', nameBn: 'বরিশাল',
    districts: [
      { name: 'Barishal', nameBn: 'বরিশাল' }, { name: 'Bhola', nameBn: 'ভোলা' },
      { name: 'Barguna', nameBn: 'বরগুনা' }, { name: 'Jhalokati', nameBn: 'ঝালকাঠি' },
      { name: 'Patuakhali', nameBn: 'পটুয়াখালী' }, { name: 'Pirojpur', nameBn: 'পিরোজপুর' },
    ],
  },
  {
    name: 'Sylhet', nameBn: 'সিলেট',
    districts: [
      { name: 'Sylhet', nameBn: 'সিলেট', thanas: ['Sylhet Sadar', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Zakiganj', 'Osmani Nagar'] },
      { name: 'Moulvibazar', nameBn: 'মৌলভীবাজার' }, { name: 'Habiganj', nameBn: 'হবিগঞ্জ' },
      { name: 'Sunamganj', nameBn: 'সুনামগঞ্জ' },
    ],
  },
  {
    name: 'Rangpur', nameBn: 'রংপুর',
    districts: [
      { name: 'Rangpur', nameBn: 'রংপুর' }, { name: 'Dinajpur', nameBn: 'দিনাজপুর' },
      { name: 'Gaibandha', nameBn: 'গাইবান্ধা' }, { name: 'Kurigram', nameBn: 'কুড়িগ্রাম' },
      { name: 'Lalmonirhat', nameBn: 'লালমনিরহাট' }, { name: 'Nilphamari', nameBn: 'নীলফামারী' },
      { name: 'Panchagarh', nameBn: 'পঞ্চগড়' }, { name: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও' },
    ],
  },
  {
    name: 'Mymensingh', nameBn: 'ময়মনসিংহ',
    districts: [
      { name: 'Mymensingh', nameBn: 'ময়মনসিংহ' }, { name: 'Jamalpur', nameBn: 'জামালপুর' },
      { name: 'Netrokona', nameBn: 'নেত্রকোণা' }, { name: 'Sherpur', nameBn: 'শেরপুর' },
    ],
  },
];

export const ALL_DISTRICTS = BD_DIVISIONS.flatMap((d) => d.districts.map((x) => ({ ...x, division: d.name })));
