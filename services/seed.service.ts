import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { Category } from './categories.service';

@Service({
  name: 'seed',
})
export default class SeedService extends moleculer.Service {
  @Action()
  async real(ctx: Context<Record<string, unknown>>) {
    const usersCount: number = await ctx.call('users.count');

    if (!usersCount) {
      const data: any[] = await ctx.call('auth.getSeedData');

      for (const item of data) {
        await ctx.call('auth.createUserWithTenantsIfNeeded', {
          authUser: item,
          authUserGroups: item.groups,
        });
      }
    }

    const categoriesCount: number = await ctx.call('categories.count');
    if (!categoriesCount) {
      await this.seedCategories();
    }

    const additionalInfoCount: number = await ctx.call('additionalInfos.count');
    if (!additionalInfoCount) {
      await this.seedAdditionalInfo();
    }

    const visitInfosCount: number = await ctx.call('visitInfos.count');
    if (!visitInfosCount) {
      await this.seedVisitInfos();
    }

    return true;
  }

  @Method
  seedVisitInfos() {
    const data = [
      {
        name: 'Ne, objektas ir jo aplinka nėra pritaikyti lankymui',
      },
      {
        name: 'Iš dalies, objektas ir jo aplinka pritaikyti lankymui, tačiau yra tvarkytinų dalykų',
      },
      {
        name: 'Taip, objektas ir jo aplinka visiškai sutvarkyti ir pritaikyti lankymui',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      this.broker.call('visitInfos.create', {
        ...data[i],
      });
    }
  }

  @Method
  seedAdditionalInfo() {
    const data = [
      {
        name: 'Būtina rezervacija iš anksto',
      },
      {
        name: 'Galimybė atsivesti augintinius',
      },
      {
        name: 'Galimybė lankytis neįgaliesiems',
      },
      {
        name: 'Galimybė atsiskaityti kortele',
      },
      {
        name: 'Tinkama su vaikais',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      this.broker.call('additionalInfos.create', {
        ...data[i],
      });
    }
  }

  @Method
  seedCategories() {
    const data = [
      {
        children: [
          {
            name: 'Muziejai ir galerijos',
          },
          {
            name: 'Pilys ir dvarai',
          },
          {
            name: 'Skulptūros ir paminklai',
          },
          {
            name: 'Švyturiai',
          },
          {
            name: 'Fortai',
          },
          {
            name: 'Aikštės',
          },
          {
            name: 'Tiltai',
          },
          {
            name: 'Griuvėsiai',
          },
          {
            name: 'Kitos istorinės vietos',
          },
          {
            name: 'Teatrai ir koncertų salės',
          },
          {
            name: 'Kino teatrai',
          },
          {
            name: 'Menų dirbtuvės',
          },
          {
            name: 'Kitos meno erdvės',
          },
        ],
        name: 'Istorija ir kultūra',
      },
      {
        children: [
          {
            name: 'Nuotykiai ir atrakcionai',
          },
          {
            name: 'Vaikų žaidimų kambariai',
          },
          {
            name: 'Pabėgimo kambariai',
          },
          {
            name: 'Ekstremalios pramogos',
          },
          {
            name: 'Skrydžiai oro balionais',
          },
          {
            name: 'Slidinėjimas',
          },
          {
            name: 'Golfo aikštynai',
          },
          {
            name: 'Žirgynai',
          },
          {
            name: 'Sporto arenos ir aikštelės',
          },
          {
            name: 'Dviračių takai',
          },
          {
            name: 'Kitos aktyvios pramogos',
          },
        ],
        name: 'Aktyvios pramogos',
      },
      {
        children: [
          {
            name: 'Baidarės ir kanojos',
          },
          {
            name: 'Vandenlenčių parkai',
          },
          {
            name: 'Jėgos aitvarai',
          },
          {
            name: 'Irklentės',
          },
          {
            name: 'Buriavimas',
          },
          {
            name: 'Vandens pramogų parkai',
          },
          {
            name: 'Plaukiojimas laivais',
          },
          {
            name: 'Kitos vandens pramogos',
          },
        ],
        name: 'Vandens pramogos',
      },
      {
        children: [
          {
            name: 'Pažintiniai takai',
          },
          {
            name: 'Apžvalgos bokštai, aikštelės ir atodangos',
          },
          {
            name: 'Parkai ir sodai',
          },
          {
            name: 'Piliakalniai',
          },
          {
            name: 'Pilkapiai',
          },
          {
            name: 'Paplūdimiai',
          },
          {
            name: 'Zoologijos sodai ir ūkiai',
          },
          {
            name: 'Paukščių stebėjimos vietos',
          },
          {
            name: 'Nacionalinių parkų lankytojų centrai',
          },
          {
            name: 'Regioninių parkų lankytojų centrai',
          },
          {
            name: 'Kitos saugomos teritorijos',
          },
          {
            name: 'Kiti gamtos objektai',
          },
        ],
        name: 'Gamta',
      },
      {
        children: [
          {
            name: 'Bažnyčios',
          },
          {
            name: 'Vienuolynai',
          },
          {
            name: 'Piligrimystė',
          },
          {
            name: 'Koplyčios ir kryžiai',
          },
          {
            name: 'Singagogos',
          },
          {
            name: 'Kitos žydų paveldo vietos',
          },
          {
            name: 'Cerkvės',
          },
          {
            name: 'Kenesos',
          },
          {
            name: 'Pagoniškos vietos',
          },
          {
            name: 'Kitos religinės vietos',
          },
        ],
        name: 'Religiniai objektai',
      },
      {
        children: [
          {
            name: 'Restoranai',
          },
          {
            name: 'Kavinės ir kepyklėlės',
          },
          {
            name: 'Barai',
          },
          {
            name: 'Greito maisto restoranai',
          },
          {
            name: 'Naktinis gyvenimas',
          },
          {
            name: 'Maisto gamybos dirbtuvės',
          },
        ],
        name: 'Gastronomija ir naktinis gyvenimas',
      },
      {
        children: [
          {
            name: 'SPA centrai',
          },
          {
            name: 'Masažo salonai',
          },
          {
            name: 'Baseinai',
          },
          {
            name: 'Pirtys',
          },
          {
            name: 'Reabilitacijos centrai ir sanatorijos',
          },
          {
            name: 'Medicinos centrai',
          },
          {
            name: 'Kiti sveikatingumo objektai',
          },
        ],
        name: 'Sveikatingumas',
      },
      {
        children: [
          {
            name: 'Vietinio dizaino butikai',
          },
          {
            name: 'Turgavietės',
          },
          {
            name: 'Ūkininkų turgeliai ir organiški produktai',
          },
          {
            name: 'Vietiniai suvenyrai ir rankų darbo gaminiai',
          },
        ],
        name: 'Apsipirkimas',
      },
      {
        children: [
          {
            name: 'Viešbučiai',
          },
          {
            name: 'SPA viešbučiai',
          },
          {
            name: 'Apartamentai',
          },
          {
            name: 'Svečių namai',
          },
          {
            name: 'Moteliai',
          },
          {
            name: 'Kaimo turizmo sodybos',
          },
          {
            name: 'Kotedžai ir atostogų nameliai',
          },
          {
            name: 'Poilsio namai',
          },
          {
            name: 'Vilos',
          },
          {
            name: 'Nakvynės namai',
          },
          {
            name: 'Kempingai',
          },
          {
            name: 'Stovyklavietės',
          },
          {
            name: 'Neįprastos nakvynės vietos',
          },
        ],
        name: 'Apgyvendinimas',
      },
      {
        children: [
          {
            name: 'Keltai ir laivai',
          },
          {
            name: 'Autobusų stotys',
          },
          {
            name: 'Traukinių stotys',
          },
          {
            name: 'Oro uostai',
          },
          {
            name: 'Dviračių nuomos vietos',
          },
          {
            name: 'Automobilių nuomos vietos',
          },
          {
            name: 'Kemperių nuoma',
          },
          {
            name: 'Elektromobilių įkrovimo stotelės',
          },
          {
            name: 'Kitas transportas',
          },
        ],

        name: 'Transportas',
      },
      {
        children: [
          {
            name: 'Turizmo informacijos centrai',
          },
          {
            name: 'Viešieji tualetai',
          },
        ],

        name: 'Praktinė informacija turistui',
      },
      {
        children: [
          {
            name: 'Bendradarbystės erdvės',
          },
          {
            name: 'Konferencijų salės',
          },
        ],

        name: 'Verslo turizmas',
      },
      {
        children: [
          {
            name: 'Su gidais',
          },
          {
            name: 'Savarankiški',
          },
        ],

        name: 'Turai',
      },
    ];

    const seedCategoriesRec = async (
      items: Category[],
      parent: number | null = null
    ) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const category: Category = await this.broker.call('categories.create', {
          name: item.name,
          parent,
        });

        if (item.children) {
          seedCategoriesRec(item.children, category.id);
        }
      }
    };

    seedCategoriesRec(data);
  }

  @Action()
  run() {
    return this.broker
      .waitForServices([
        'auth',
        'users',
        'tenants',
        'tenantUsers',
        'categories',
      ])
      .then(async () => {
        await this.broker.call('seed.real', {}, { timeout: 120 * 1000 });
      });
  }
}
