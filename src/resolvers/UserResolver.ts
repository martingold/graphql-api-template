import { Arg, Authorized, Mutation, Query, Resolver } from 'type-graphql';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { Inject } from 'typedi';
import { UserRepository } from '../models/user/UserRepository';
import { User } from '../models/user/User';
import { AuthService } from '../models/user/AuthService';
import { UserInput } from '../models/user/UserInput';
import { RequestContainer } from '../decorators/RequestContainer';
import { UserLoader } from '../models/user/UserLoader';

@Resolver(User)
export class UserResolver {
    public constructor(
        @InjectRepository() private readonly userRepository: UserRepository,
        @Inject('AuthService') private readonly authService: AuthService
    ) {}

    @Authorized()
    @Query(() => User, { description: 'Get user by id', nullable: true })
    public async user(
        @Arg('userId') userId: string,
        @RequestContainer() userLoader: UserLoader,
    ): Promise<User> {
        const model = await userLoader.load(userId);
        if (model === undefined) {
            return null;
        }
        return model;
    }

    @Mutation(() => User, { description: 'Login/Register new user' })
    public async login(@Arg('user') userInput: UserInput): Promise<User> {
        const token = await this.authService.verifyTokenId(userInput.tokenId);

        const user = await this.userRepository.findOne({
            where: {
                email: token.email,
            },
        });

        if (user) {
            return user;
        }

        const newUser = this.userRepository.create();
        newUser.name = token.name;
        newUser.email = token.email;
        newUser.picture = token.picture;
        newUser.accessToken = this.authService.generateAccessToken();
        await this.userRepository.save(newUser);

        return this.userRepository.findOne(newUser.userId);
    }
}
